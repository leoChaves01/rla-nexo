import type { NextConfig } from 'next';
import path from 'node:path';
const config:NextConfig={reactStrictMode:true, outputFileTracingRoot:path.join(__dirname,"../.."), serverExternalPackages:["@nestjs/common","@nestjs/core","pg"], devIndicators:false};
export default config;

