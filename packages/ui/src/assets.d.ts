/** Vite `?url` imports (hashed asset URLs at build). The apps get the same type from vite/client. */
declare module '*?url' {
  const src: string;
  export default src;
}
