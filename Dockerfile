# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
# If you are using yarn, replace package-lock.json with yarn.lock
# If you are using pnpm, replace package-lock.json with pnpm-lock.yaml
COPY package.json package-lock.json ./

# Install dependencies. npm ci is used for clean installs in CI/CD environments.
RUN npm ci --prefer-offline --no-audit

# Copy the rest of your application code
COPY . .

# Build the Next.js application
# This command generates the optimized production build in the .next directory
RUN npm run build

# Stage 2: Run the Next.js application in a lightweight production environment
FROM node:20-alpine AS runner

# Set the working directory inside the container
WORKDIR /app

# Set environment variables for production
ENV NODE_ENV production

# Copy necessary files from the builder stage to the runner stage
# This includes the built Next.js application, public assets, and node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the port that Next.js uses (default is 3000)
# EasyPanel will detect this port and configure the reverse proxy accordingly
EXPOSE 3000

# Command to start the Next.js application in production mode
CMD ["npm", "start"]
