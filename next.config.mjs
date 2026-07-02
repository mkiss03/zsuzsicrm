/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // typedRoutes: true,  // re-enable once all route pages exist
    // Font files are loaded from the filesystem at runtime via a dynamically
    // built path (invoice-pdf.tsx), so Next's output file tracer can't detect
    // the dependency on its own — force-include them in the serverless bundle.
    outputFileTracingIncludes: {
      "/api/**/*": ["./public/fonts/**"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
