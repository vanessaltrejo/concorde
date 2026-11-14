// Data sources, methods and the planning disclaimer.
export function Credits() {
  return (
    <section className="flex flex-col gap-2 border-t border-gray-200 pt-4 text-xs text-gray-500">
      <p className="font-medium text-gray-700">Planning aid, not flight grade.</p>
      <details>
        <summary className="cursor-pointer text-gray-700">Data sources and methods</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
          <li>Sun and Earth positions: NASA/JPL Horizons API (observer on the Moon, airless).</li>
          <li>
            Terrain: LOLA 20 m south pole DEM, Barker et al. 2023, Planet. Sci. J. 4, 183
            (NASA PGDA product 90).
          </li>
          <li>
            Site: Shackleton rim, Gläser et al. 2018, Planetary and Space Science 162, Table 1.
          </li>
          <li>
            Earth image: NASA Blue Marble Next Generation with topography and bathymetry (December
            2004), oriented with the Horizons
            sub-observer point.
          </li>
          <li>Horizon and shadows: terrain horizon method (Mazarico et al. 2011, Icarus 211).</li>
          <li>Terrain shading: lunar-Lambert reflectance (McEwen 1991).</li>
          <li>
            Checks: positions match the Horizons web app; 20-year sunlight 79.1% vs 81.0% in Gläser
            et al. 2018.
          </li>
          <li>
            Visual aids: earthshine on the terrain is boosted, shadowed ground is lifted to dark
            gray, and a gray line marks the computed horizon.
          </li>
        </ul>
      </details>
    </section>
  )
}
