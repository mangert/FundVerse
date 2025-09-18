//организация хранилища для списка кампаний
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

//функция записывает данные в хранилище
export function saveState(obj: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.warn("Failed to persist state:", e);
  }
}
// функция загружает данные из хранилища
export function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch (e) {
    console.warn("Failed to load state:", e);
    return null;
  }
}
