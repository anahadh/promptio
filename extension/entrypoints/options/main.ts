import { loadKeys, saveKeys } from "../../lib/keys";

const form = document.querySelector<HTMLFormElement>("#keys")!;
const typesafe = document.querySelector<HTMLInputElement>("#typesafe")!;
const anthropic = document.querySelector<HTMLInputElement>("#anthropic")!;
const status = document.querySelector<HTMLSpanElement>("#status")!;

void loadKeys().then((keys) => {
  typesafe.value = keys.typesafe;
  anthropic.value = keys.anthropic;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveKeys({ typesafe: typesafe.value, anthropic: anthropic.value });
  status.textContent = " Saved.";
});
