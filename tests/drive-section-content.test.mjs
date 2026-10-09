import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require=createRequire(import.meta.url);
function fixture(options={}) {
 const bytes=Buffer.from("%PDF-1.4\nVerified original");const requests=[];
 const client={request:async input=>{requests.push(input);return input.params?.alt==="media" ? {data:options.downloadBytes || bytes} : {data:{name:"lesson.pdf",size:String(bytes.length),mimeType:"application/pdf",capabilities:{canDownload:true},...options.metadata}};}};
 const exports={};
 const deps={"server-only":{},"./connection":{authorizedDriveClient:async()=>client},"./destinations":{selectedDestination:async()=>({folder_id:"folder-test-id"}),verifyDriveFolder:async()=>{}},"./sourceUpload":{saveDriveOriginal:async()=>"file-test-id-12345"},"@/lib/sectionContent":{MAX_SECTION_BYTES:50*1024*1024}};
 const code=ts.transpileModule(fs.readFileSync("lib/drive/sectionContent.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,Buffer,TextDecoder,Uint8Array,URL,require:n=>deps[n]??require(n)});
 return {helper:exports,bytes,requests};
}
test("Drive content IDs accept file links and reject other hosts and injected paths",()=>{
 const {helper}=fixture();assert.equal(helper.driveFileId("https://drive.google.com/file/d/file-test-id-12345/view"),"file-test-id-12345");assert.equal(helper.driveFileId("drive:file-test-id-12345"),"file-test-id-12345");
 for(const value of ["https://example.com/file/d/file-test-id-12345/view","../file-test-id-12345","https://drive.google.com/drive/folders/folder-test-id"] ) assert.throws(()=>helper.driveFileId(value));
});
test("private Drive download uses server credentials and validates content length",async()=>{
 const {helper,bytes,requests}=fixture();const file=await helper.readDriveFile("file-test-id-12345");assert.deepEqual(Buffer.from(file.bytes),bytes);assert.equal(requests[1].params.alt,"media");assert.equal(requests[1].responseType,"arraybuffer");
});
test("trashed, oversized, Google Workspace, or nondownloadable files are rejected before media fetch",async()=>{
 for(const metadata of [{trashed:true},{size:String(51*1024*1024)},{mimeType:"application/vnd.google-apps.document"},{capabilities:{canDownload:false}}]){const {helper,requests}=fixture({metadata});await assert.rejects(helper.readDriveFile("file-test-id-12345"),/Unable to read/);assert.equal(requests.length,1);}
});
test("truncated media is rejected",async()=>{const {helper}=fixture({downloadBytes:Buffer.from("short")});await assert.rejects(helper.readDriveFile("file-test-id-12345"),/Unable to read/);});
test("uploaded files are read back and hashed before receiving a published Drive reference",async()=>{
 const {helper,bytes}=fixture();const id=await helper.uploadDriveSection({sectionId:"section",destinationId:"dest",name:"lesson.pdf",mimeType:"application/pdf",bytes});assert.equal(id,"file-test-id-12345");
 const f=fixture({downloadBytes:Buffer.from(bytes.toString().replace("Verified","Modified"))});await assert.rejects(f.helper.uploadDriveSection({sectionId:"section",destinationId:"dest",name:"lesson.pdf",mimeType:"application/pdf",bytes}),/verification failed/);
});
