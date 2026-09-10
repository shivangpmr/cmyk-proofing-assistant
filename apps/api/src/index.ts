import app from "./app.js";

const PORT = Number(process.env.PORT ?? 8787);

app.listen(PORT, () => {
  console.log(`CMYK Proofing API listening on http://localhost:${PORT}`);
});
