# Section content upload

## Upload from PC in Admin Access

In **Course Setup & Structure → Course Sections**, choose the upload arrow
(**Upload from PC**), select a PDF, PPTX or compiled lesson JS up to 50 MB,
then select a saved Drive destination and choose **Upload file**. A connected
Drive account and a saved destination are required. The file is saved to Drive
and becomes the section's lesson source, including replacements of registered
project JS. The protected Applied Agentic AI Section 1 and Section 2 accept
PPTX attachments only. Existing lesson interactions remain intact.

The **T** icon enables section termination; a dimmed, crossed-out T disables it.
Uploads validate file contents on the server, reject concurrent writes when
the section's file reference changes, and show failures without overwriting the
current source. After a timeout, refresh the section before retrying because
the server may still finish the upload.

Run `supabase/migrations/202610030002_section_content.sql` before deploying this feature.

The presentation chrome (EIU header, navigation, zoom, fullscreen, responsive 16:9 frame) is owned by the application and is shared by every course section. Admin-uploaded files provide only the slide content.

The original Section 1 and Section 2 are protected as built-in decks so their quiz, showcase, realtime, and workshop interactions remain intact. Create a new section before uploading a new file.

## PDF

Upload one PDF to a section from **Admin Access → Course Setup & Structure → Course Sections**. Each PDF page becomes one slide automatically.

## TSX

TSX decks run inside a sandboxed iframe. The file must be self-contained: no imports, `require`, network requests, storage/session access, or parent-window access.

Export an array of slides. Each item can be JSX or a function returning JSX:

```tsx
const slides = [
  <section className="slide" style={{ padding: "56px", background: "#082945", color: "white" }}>
    <small>EIU · COURSE</small>
    <h1>First slide</h1>
    <button onClick={(event) => { event.currentTarget.textContent = "Done" }}>
      Try interaction
    </button>
  </section>,
  () => (
    <section className="slide" style={{ padding: "56px" }}>
      <h1>Second slide</h1>
    </section>
  ),
];

export default slides;
```

Use inline styles or include a `<style>` element in the TSX file. The content canvas is always 16:9 and fills the shared frame.
