/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Les fiches d'expertise de l'analyste IA sont lues à l'exécution.
  outputFileTracingIncludes: { "/api/analyse": ["./skills/**/*"] },
};
export default nextConfig;
