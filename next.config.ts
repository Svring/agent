import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';

const nextConfig: NextConfig = {
  // Add configuration to handle binary files
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    // Keep binary files as is during build process
    config.module?.rules?.push({
      test: /\.(bin|exe|dll|so|dylib)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'static/binaries/',
            publicPath: '/_next/static/binaries/',
          },
        },
      ],
    });
    
    return config;
  },
};

export default withPayload(nextConfig);
