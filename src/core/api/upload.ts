/**
 * A file picked on the phone (camera, photo library or documents), ready to upload. The web
 * sends a browser `File`; React Native sends `{ uri, name, type }` in the same multipart
 * field, so the backend receives exactly what it receives from the web.
 */
export type PickedFile = {
  uri: string;
  name: string;
  /** MIME type, e.g. image/jpeg, application/pdf. */
  type: string;
  /** Bytes, when the picker reports it. */
  size?: number;
};

/** Puts a picked file in the form under `field` (the backend's upload endpoints all use `file`). */
export function appendFile(form: FormData, file: PickedFile, field = 'file') {
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}
