import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Esto hace que el service worker se active al instante
  register: true, 
  // Cachea automáticamente todas las rutas y archivos de Vercel
  cacheOnFrontEndNav: true, 
  aggressiveFrontEndNavCaching: true,
  // En desarrollo (localhost) lo desactivamos para que no te vuelva loco la caché
  disable: process.env.NODE_ENV === "development", 
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aquí irían otras configuraciones de Next si las tuvieras
};

export default withPWA(nextConfig);