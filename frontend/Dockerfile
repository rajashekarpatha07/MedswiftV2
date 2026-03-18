# Stage 1: Build the Vite App
FROM node:22-slim AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json ./
# Assuming you use npm or pnpm in frontend. Adjust if using yarn.
RUN pnpm install 
COPY . .
RUN pnpm build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy the built React files
COPY --from=build /app/dist /usr/share/nginx/html
# Copy our custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]