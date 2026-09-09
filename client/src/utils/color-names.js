/**
 * The named-colour table and nearest-match search from admin/colors/index.blade.php.
 *
 * Copied verbatim, all 92 entries in their original order. The list is not a palette to
 * curate — it is what decides the name the Colors form autofills when a swatch is picked, so
 * adding or reordering entries changes what the panel suggests.
 *
 * Matching is plain Euclidean distance in RGB, exactly as the original. It is not
 * perceptually accurate (Lab would be), but changing the metric would change the suggested
 * names, and matching the existing behaviour is the point.
 */
export const COLOR_NAMES = [
  ['Black', '#000000'],
  ['White', '#FFFFFF'],
  ['Red', '#FF0000'],
  ['Lime', '#00FF00'],
  ['Blue', '#0000FF'],
  ['Yellow', '#FFFF00'],
  ['Cyan', '#00FFFF'],
  ['Magenta', '#FF00FF'],
  ['Silver', '#C0C0C0'],
  ['Gray', '#808080'],
  ['Maroon', '#800000'],
  ['Olive', '#808000'],
  ['Green', '#008000'],
  ['Purple', '#800080'],
  ['Teal', '#008080'],
  ['Navy', '#000080'],
  ['Orange', '#FFA500'],
  ['Pink', '#FFC0CB'],
  ['Brown', '#A52A2A'],
  ['Beige', '#F5F5DC'],
  ['Ivory', '#FFFFF0'],
  ['Khaki', '#F0E68C'],
  ['Lavender', '#E6E6FA'],
  ['Coral', '#FF7F50'],
  ['Salmon', '#FA8072'],
  ['Tomato', '#FF6347'],
  ['Gold', '#FFD700'],
  ['Indigo', '#4B0082'],
  ['Violet', '#EE82EE'],
  ['Orchid', '#DA70D6'],
  ['Plum', '#DDA0DD'],
  ['Tan', '#D2B48C'],
  ['Wheat', '#F5DEB3'],
  ['Chocolate', '#D2691E'],
  ['Peru', '#CD853F'],
  ['Sienna', '#A0522D'],
  ['Crimson', '#DC143C'],
  ['Hot Pink', '#FF69B4'],
  ['Deep Pink', '#FF1493'],
  ['Light Blue', '#ADD8E6'],
  ['Sky Blue', '#87CEEB'],
  ['Dodger Blue', '#1E90FF'],
  ['Royal Blue', '#4169E1'],
  ['Steel Blue', '#4682B4'],
  ['Turquoise', '#40E0D0'],
  ['Aquamarine', '#7FFFD4'],
  ['Sea Green', '#2E8B57'],
  ['Forest Green', '#228B22'],
  ['Lime Green', '#32CD32'],
  ['Olive Drab', '#6B8E23'],
  ['Dark Gray', '#A9A9A9'],
  ['Dim Gray', '#696969'],
  ['Slate Gray', '#708090'],
  ['Charcoal', '#36454F'],
  ['Cream', '#FFFDD0'],
  ['Off White', '#FAF9F6'],
  ['Burgundy', '#800020'],
  ['Mustard', '#FFDB58'],
  ['Peach', '#FFE5B4'],
  ['Mint', '#98FF98'],
  ['Baby Blue', '#89CFF0'],
  ['Lilac', '#C8A2C8'],
  ['Rose', '#FF007F'],
  ['Wine', '#722F37'],
  ['Rust', '#B7410E'],
  ['Copper', '#B87333'],
  ['Bronze', '#CD7F32'],
  ['Champagne', '#F7E7CE'],
  ['Mauve', '#E0B0FF'],
  ['Fuchsia', '#FF00FF'],
  ['Azure', '#F0FFFF'],
  ['Alice Blue', '#F0F8FF'],
  ['Midnight Blue', '#191970'],
  ['Dark Green', '#006400'],
  ['Dark Red', '#8B0000'],
  ['Dark Orange', '#FF8C00'],
  ['Light Gray', '#D3D3D3'],
  ['Gainsboro', '#DCDCDC'],
  ['Snow', '#FFFAFA'],
  ['Honeydew', '#F0FFF0'],
  ['Sand', '#C2B280'],
  ['Taupe', '#483C32'],
  ['Espresso', '#3C1414'],
  ['Denim', '#1560BD'],
  ['Cobalt', '#0047AB'],
  ['Emerald', '#50C878'],
  ['Jade', '#00A86B'],
  ['Amber', '#FFBF00'],
  ['Apricot', '#FBCEB1'],
  ['Blush', '#DE5D83'],
  ['Berry', '#8E4585'],
  ['Grape', '#6F2DA8'],
]

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  }
}

const distance = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)

/** Falls back to 'Custom' only when the table is empty; otherwise something always wins. */
export function closestColorName(hex) {
  const target = hexToRgb(hex)
  let bestName = 'Custom'
  let bestDist = Infinity

  COLOR_NAMES.forEach(([name, value]) => {
    const dist = distance(target, hexToRgb(value))
    if (dist < bestDist) {
      bestDist = dist
      bestName = name
    }
  })

  return bestName
}

/** Adds a missing '#', expands #abc to #aabbcc, upper-cases. Empty input stays empty. */
export function normalizeHex(value) {
  let v = String(value ?? '').trim()
  if (!v) return ''
  if (v[0] !== '#') v = `#${v}`
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return v.toUpperCase()
}
