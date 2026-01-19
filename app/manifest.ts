import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Studio FISYO - Gestionale",
        short_name: "FISYO",
        description: "Gestionale appuntamenti per Studio FISYO",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#facc15",
        icons: [
            {
                src: "/brand/icon-192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/brand/icon-512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
    };
}
