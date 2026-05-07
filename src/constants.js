const BASE = import.meta.env.BASE_URL;

export const MAPS = [
  { id: "erin",      label: "Erin",      src: `${BASE}Erin.jpg` },
  { id: "manx",      label: "Manx",      src: `${BASE}Manx.png` },
  { id: "cymria",    label: "Cymria",     src: `${BASE}Cymria.png` },
  { id: "caledonia", label: "Caledonia", src: `${BASE}Cal.jpg` },
];

export const FACTIONS = {
  player:    { color: "#2d6e3e", border: "#a8d5b5", label: "Player",    icon: "⚔" },
  enemy:     { color: "#7a7a7a", border: "#000000", label: "Enemy",     icon: "☠" },
  contested: { color: "#640264", border: "#e8a0d2", label: "Contested", icon: "⚔" },
};

export const NATIONS = {
  erin:      { color: "#1e5c32", border: "#62c279", label: "Erin",      mapId: "erin" },
  manx:      { color: "#6e1818", border: "#d05050", label: "Manx",      mapId: "manx" },
  caledonia: { color: "#172a6e", border: "#5882d8", label: "Caledonia", mapId: "caledonia" },
  cymria:    { color: "#5c4818", border: "#d4aa30", label: "Cymria",    mapId: "cymria" },
};

export const TOKEN_RADIUS    = 8;
export const MERGE_THRESHOLD = TOKEN_RADIUS * 1.4;
export const SAVE_DEBOUNCE   = 1200;
