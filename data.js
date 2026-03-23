/* ============================================================
   AI Interior Designer — Mock Data
   ============================================================ */

// ---------- Furniture Catalog ----------
const FURNITURE_CATALOG = {
    bedroom: {
        modern: [
            { name: "Platform Bed Frame", icon: "🛏️", basePct: 0.28 },
            { name: "Memory Foam Mattress", icon: "🛌", basePct: 0.22 },
            { name: "Floating Nightstand (x2)", icon: "🗄️", basePct: 0.10 },
            { name: "LED Strip Lighting", icon: "💡", basePct: 0.06 },
            { name: "Minimalist Wardrobe", icon: "👔", basePct: 0.18 },
            { name: "Abstract Wall Art", icon: "🖼️", basePct: 0.08 },
            { name: "Accent Rug", icon: "🟫", basePct: 0.08 }
        ],
        minimal: [
            { name: "Low-profile Bed", icon: "🛏️", basePct: 0.25 },
            { name: "Organic Mattress", icon: "🛌", basePct: 0.22 },
            { name: "Simple Side Table", icon: "🪑", basePct: 0.08 },
            { name: "Pendant Light", icon: "💡", basePct: 0.07 },
            { name: "Capsule Wardrobe Unit", icon: "👔", basePct: 0.20 },
            { name: "Linen Curtains", icon: "🪟", basePct: 0.10 },
            { name: "Floor Plant", icon: "🪴", basePct: 0.08 }
        ],
        traditional: [
            { name: "Carved Wooden Bed", icon: "🛏️", basePct: 0.30 },
            { name: "Spring Mattress", icon: "🛌", basePct: 0.18 },
            { name: "Antique Nightstands (x2)", icon: "🗄️", basePct: 0.12 },
            { name: "Chandelier", icon: "💡", basePct: 0.10 },
            { name: "Wooden Almirah", icon: "👔", basePct: 0.16 },
            { name: "Silk Drapes", icon: "🪟", basePct: 0.08 },
            { name: "Persian Rug", icon: "🟫", basePct: 0.06 }
        ],
        luxury: [
            { name: "King Upholstered Bed", icon: "🛏️", basePct: 0.26 },
            { name: "Premium Latex Mattress", icon: "🛌", basePct: 0.20 },
            { name: "Marble Nightstands (x2)", icon: "🗄️", basePct: 0.12 },
            { name: "Crystal Pendant Lights", icon: "💡", basePct: 0.10 },
            { name: "Walk-in Closet System", icon: "👔", basePct: 0.18 },
            { name: "Velvet Lounge Chair", icon: "🪑", basePct: 0.08 },
            { name: "Smart Home Controls", icon: "📱", basePct: 0.06 }
        ]
    },
    living: {
        modern: [
            { name: "L-Shaped Sofa", icon: "🛋️", basePct: 0.28 },
            { name: "Glass Coffee Table", icon: "☕", basePct: 0.10 },
            { name: "TV Console Unit", icon: "📺", basePct: 0.14 },
            { name: "Floor Lamp", icon: "💡", basePct: 0.07 },
            { name: "Accent Armchair", icon: "🪑", basePct: 0.12 },
            { name: "Wall-mount Shelves", icon: "📚", basePct: 0.09 },
            { name: "Modern Art Canvas", icon: "🖼️", basePct: 0.06 },
            { name: "Indoor Plant Set", icon: "🪴", basePct: 0.07 },
            { name: "Smart LED Downlights", icon: "💡", basePct: 0.07 }
        ],
        minimal: [
            { name: "Scandinavian Sofa", icon: "🛋️", basePct: 0.30 },
            { name: "Wooden Coffee Table", icon: "☕", basePct: 0.10 },
            { name: "Minimalist TV Stand", icon: "📺", basePct: 0.12 },
            { name: "Paper Pendant Lamp", icon: "💡", basePct: 0.06 },
            { name: "Wire Chair", icon: "🪑", basePct: 0.10 },
            { name: "Floating Shelf", icon: "📚", basePct: 0.07 },
            { name: "Woven Basket Set", icon: "🧺", basePct: 0.05 },
            { name: "Fiddle Leaf Fig", icon: "🪴", basePct: 0.06 },
            { name: "Jute Rug", icon: "🟫", basePct: 0.07 },
            { name: "Simple Clock", icon: "🕐", basePct: 0.07 }
        ],
        traditional: [
            { name: "Chesterfield Sofa Set", icon: "🛋️", basePct: 0.30 },
            { name: "Carved Wooden Table", icon: "☕", basePct: 0.10 },
            { name: "Wooden TV Cabinet", icon: "📺", basePct: 0.14 },
            { name: "Brass Floor Lamp", icon: "💡", basePct: 0.08 },
            { name: "Rocking Chair", icon: "🪑", basePct: 0.10 },
            { name: "Bookshelf", icon: "📚", basePct: 0.08 },
            { name: "Oil Painting", icon: "🖼️", basePct: 0.06 },
            { name: "Decorative Vases", icon: "🏺", basePct: 0.05 },
            { name: "Oriental Rug", icon: "🟫", basePct: 0.09 }
        ],
        luxury: [
            { name: "Italian Leather Sofa", icon: "🛋️", basePct: 0.26 },
            { name: "Marble Coffee Table", icon: "☕", basePct: 0.12 },
            { name: "Custom Media Wall", icon: "📺", basePct: 0.14 },
            { name: "Designer Floor Lamp", icon: "💡", basePct: 0.08 },
            { name: "Barcelona Chair", icon: "🪑", basePct: 0.10 },
            { name: "Display Cabinet", icon: "📚", basePct: 0.08 },
            { name: "Sculpted Art Piece", icon: "🗿", basePct: 0.06 },
            { name: "Cashmere Throw", icon: "🧣", basePct: 0.04 },
            { name: "Automated Curtains", icon: "🪟", basePct: 0.06 },
            { name: "Ambient Sound System", icon: "🔊", basePct: 0.06 }
        ]
    },
    kitchen: {
        modern: [
            { name: "Modular Kitchen Set", icon: "🍳", basePct: 0.32 },
            { name: "Quartz Countertop", icon: "🪨", basePct: 0.18 },
            { name: "Island Counter", icon: "🏝️", basePct: 0.14 },
            { name: "Under-cabinet LED Lights", icon: "💡", basePct: 0.06 },
            { name: "Bar Stools (x3)", icon: "🪑", basePct: 0.10 },
            { name: "Built-in Appliances", icon: "🔌", basePct: 0.12 },
            { name: "Herb Planter Set", icon: "🌿", basePct: 0.04 },
            { name: "Backsplash Tiles", icon: "🔲", basePct: 0.04 }
        ],
        minimal: [
            { name: "Handle-less Cabinets", icon: "🍳", basePct: 0.30 },
            { name: "White Laminate Countertop", icon: "🪨", basePct: 0.14 },
            { name: "Compact Dining Table", icon: "🍽️", basePct: 0.12 },
            { name: "Recessed Lights", icon: "💡", basePct: 0.06 },
            { name: "Simple Bar Stools (x2)", icon: "🪑", basePct: 0.08 },
            { name: "Integrated Sink", icon: "🚰", basePct: 0.10 },
            { name: "Open Shelf Rack", icon: "📚", basePct: 0.08 },
            { name: "Ceramic Jar Set", icon: "🏺", basePct: 0.04 },
            { name: "Wooden Cutting Boards", icon: "🪵", basePct: 0.04 },
            { name: "Simple Pendant Light", icon: "💡", basePct: 0.04 }
        ],
        traditional: [
            { name: "Solid Wood Cabinets", icon: "🍳", basePct: 0.30 },
            { name: "Granite Countertop", icon: "🪨", basePct: 0.16 },
            { name: "Dining Table & Chairs", icon: "🍽️", basePct: 0.14 },
            { name: "Vintage Pendant Light", icon: "💡", basePct: 0.08 },
            { name: "Copper Utensil Rack", icon: "🍴", basePct: 0.06 },
            { name: "Spice Rack Cabinet", icon: "🫙", basePct: 0.06 },
            { name: "Classic Tile Backsplash", icon: "🔲", basePct: 0.08 },
            { name: "Cast Iron Cookware Set", icon: "🍲", basePct: 0.06 },
            { name: "Decorative Plates", icon: "🍽️", basePct: 0.06 }
        ],
        luxury: [
            { name: "Premium Modular Kitchen", icon: "🍳", basePct: 0.28 },
            { name: "Italian Marble Countertop", icon: "🪨", basePct: 0.18 },
            { name: "Waterfall Island Counter", icon: "🏝️", basePct: 0.14 },
            { name: "Smart Lighting System", icon: "💡", basePct: 0.06 },
            { name: "Designer Bar Stools (x4)", icon: "🪑", basePct: 0.10 },
            { name: "Wine Cooler Unit", icon: "🍷", basePct: 0.08 },
            { name: "High-end Appliance Suite", icon: "🔌", basePct: 0.10 },
            { name: "Glass Mosaic Backsplash", icon: "🔲", basePct: 0.06 }
        ]
    }
};

// ---------- Vastu Rules ----------
const VASTU_RULES = {
    bedroom: [
        { text: "Bed should be placed with headboard facing <strong>South or West</strong> for restful sleep.", status: "green", label: "Optimal" },
        { text: "Avoid placing <strong>mirrors directly opposite the bed</strong> — they reflect negative energy.", status: "yellow", label: "Caution" },
        { text: "The <strong>master bedroom</strong> is ideally located in the <strong>South-West</strong> corner of the house.", status: "green", label: "Optimal" },
        { text: "Avoid storing clutter or heavy items <strong>under the bed</strong>.", status: "yellow", label: "Moderate" },
        { text: "The bedroom door should <strong>not face the bathroom door</strong> directly.", status: "red", label: "Avoid" },
        { text: "Use <strong>warm, earthy colours</strong> for bedroom walls — light rose, cream, or beige.", status: "green", label: "Optimal" },
        { text: "Electronic gadgets should be kept <strong>away from the bedside</strong> for better sleep.", status: "yellow", label: "Moderate" }
    ],
    living: [
        { text: "The <strong>main entrance</strong> should ideally face <strong>North or East</strong> for positive energy flow.", status: "green", label: "Optimal" },
        { text: "Heavy furniture like sofas should be placed along the <strong>South or West walls</strong>.", status: "green", label: "Optimal" },
        { text: "The <strong>TV unit</strong> should be placed on the <strong>South-East wall</strong>.", status: "yellow", label: "Moderate" },
        { text: "Avoid placing furniture blocking <strong>natural light from windows</strong>.", status: "green", label: "Optimal" },
        { text: "A <strong>water feature or aquarium</strong> in the North-East enhances prosperity.", status: "green", label: "Optimal" },
        { text: "Avoid hanging images with <strong>negative themes</strong> (war, sorrow) on walls.", status: "red", label: "Avoid" },
        { text: "Keep the <strong>centre of the room open</strong> (Brahmasthan) for energy circulation.", status: "yellow", label: "Moderate" }
    ],
    kitchen: [
        { text: "The kitchen should ideally be in the <strong>South-East corner</strong> (Agni direction).", status: "green", label: "Optimal" },
        { text: "The <strong>cooking stove</strong> should face <strong>East</strong> — the cook should face East while cooking.", status: "green", label: "Optimal" },
        { text: "The <strong>sink and stove</strong> should not be on the same platform — fire and water clash.", status: "red", label: "Avoid" },
        { text: "Refrigerator placement in <strong>South-West</strong> direction is recommended.", status: "yellow", label: "Moderate" },
        { text: "Storage for grains and provisions should be in the <strong>North-West</strong> area.", status: "green", label: "Optimal" },
        { text: "Avoid placing the kitchen <strong>directly below or above a bathroom</strong>.", status: "red", label: "Avoid" },
        { text: "Use <strong>bright, warm lighting</strong> in the cooking area for positive energy.", status: "green", label: "Optimal" }
    ]
};

// ---------- Layout Furniture icons for drag-and-drop ----------
const LAYOUT_FURNITURE = [
    { id: "sofa", label: "Sofa", icon: "🛋️", w: 80, h: 40, color: "rgba(129,140,248,0.5)" },
    { id: "chair", label: "Chair", icon: "🪑", w: 36, h: 36, color: "rgba(167,139,250,0.5)" },
    { id: "bed", label: "Bed", icon: "🛏️", w: 70, h: 55, color: "rgba(52,211,153,0.5)" },
    { id: "table", label: "Table", icon: "☕", w: 50, h: 40, color: "rgba(251,191,36,0.5)" },
    { id: "lamp", label: "Lamp", icon: "💡", w: 24, h: 24, color: "rgba(248,113,113,0.5)" },
    { id: "plant", label: "Plant", icon: "🪴", w: 28, h: 28, color: "rgba(52,211,153,0.4)" },
    { id: "shelf", label: "Shelf", icon: "📚", w: 60, h: 20, color: "rgba(129,140,248,0.4)" }
];

// ---------- Style Color Palettes for AI Generation ----------
const STYLE_PALETTES = {
    modern: {
        overlay: "rgba(45,55,72,0.45)",
        tint: "rgba(129,140,248,0.25)",
        accent: "#818cf8",
        name: "Modern"
    },
    minimal: {
        overlay: "rgba(250,250,250,0.35)",
        tint: "rgba(200,200,200,0.2)",
        accent: "#e2e8f0",
        name: "Minimal"
    },
    traditional: {
        overlay: "rgba(120,80,40,0.35)",
        tint: "rgba(200,160,100,0.2)",
        accent: "#d4a574",
        name: "Traditional"
    },
    luxury: {
        overlay: "rgba(60,30,80,0.4)",
        tint: "rgba(200,170,50,0.2)",
        accent: "#f5c518",
        name: "Luxury"
    }
};
