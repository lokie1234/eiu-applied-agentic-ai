import test from "node:test";
import assert from "node:assert/strict";
import { readRegistrations, saveRegistration } from "../lib/registrations.mjs";

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
};
test("đăng ký hợp lệ được lưu và đọc lại", () => {
  const local = storage();
  saveRegistration(local, { name: "  An  ", email: "AN@example.com", plan: "grow", goal: "Website của tôi" });
  const records = readRegistrations(local);
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "An");
  assert.equal(records[0].email, "an@example.com");
  assert.equal(records[0].plan, "grow");
});
test("thông tin sai không tạo đăng ký thành công", () => {
  const local = storage();
  assert.throws(() => saveRegistration(local, { name: " ", email: "wrong" }));
  assert.equal(readRegistrations(local).length, 0);
});
test("lỗi lưu trữ được báo, không giả vờ đã lưu", () => {
  assert.throws(() => saveRegistration({ getItem: () => null, setItem: () => { throw new Error("Storage blocked"); } }, { name: "An", email: "an@example.com" }), /Storage blocked/);
});
