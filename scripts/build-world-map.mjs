import { readFile, writeFile } from "node:fs/promises";
import { optimize } from "svgo";

const source = new URL(
  "../node_modules/@svg-maps/world/world.svg",
  import.meta.url,
);
const destination = new URL("../public/world-map.svg", import.meta.url);

const rawMap = await readFile(source, "utf8");
const result = optimize(rawMap, {
  multipass: true,
  path: source.pathname,
  floatPrecision: 1,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          cleanupIds: false,
        },
      },
    },
    {
      name: "removeAttrs",
      params: { attrs: ["path:id", "path:aria-label"] },
    },
    "mergePaths",
    {
      name: "addAttributesToSVGElement",
      params: {
        attributes: [
          { "aria-label": "World map" },
          { role: "img" },
          { fill: "#e7e5dd" },
          { stroke: "#aeb7af" },
          { "stroke-width": "0.55" },
          { "stroke-linejoin": "round" },
          { "vector-effect": "non-scaling-stroke" },
        ],
      },
    },
  ],
});

if ("error" in result) {
  throw new Error(result.error);
}

await writeFile(
  destination,
  `<!-- Generated from @svg-maps/world (CC BY 4.0). See docs/MAP_DATA.md. -->\n${result.data}\n`,
);

const reduction = Math.round((1 - result.data.length / rawMap.length) * 100);
console.log(
  `World map: ${rawMap.length.toLocaleString()} → ${result.data.length.toLocaleString()} bytes (${reduction}% smaller)`,
);
