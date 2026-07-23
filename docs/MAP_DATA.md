# World map data

The homepage map is generated from [`@svg-maps/world`](https://www.npmjs.com/package/@svg-maps/world), an open-source country map derived from [MapSVG](https://mapsvg.com/maps/world) and licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

FirstContact keeps the source package as a dependency and commits an optimized local asset at `public/world-map.svg`. This avoids a third-party request in the browser while preserving an accurate, scalable world map.

## Rebuild

```bash
bun run map:build
```

The build script reduces coordinate precision, removes country labels that are not exposed in the presentation, and preserves country boundaries. The generated file includes its source attribution in a comment.

## Visual use

The map is illustrative. Capital routes and signal locations communicate FirstContact's global operating model; they do not represent live investor activity, exact company locations, or geopolitical boundaries.
