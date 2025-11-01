# base images
FROM node:22.5.1-alpine
RUN apk add --no-cache libc6-compat
# Create and change to the app directory.
WORKDIR /usr/app

# Copy application dependency manifests to the container images.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY . .

# Install production dependencies.
# If you add a package-lock.json, speed your build by switching to 'npm ci'.
RUN npm ci

ARG NEXTAUTHURL
ARG DATABASEURL
ARG GOOGLEID
ARG GOOGLESECRET
ARG DISCORDCLIENTID
ARG DISCORDCLIENTSECRET


ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL $NEXTAUTHURL
ENV MONGODB_URI mongodb+srv://luisencinas1506:Yssqnsns0!@cluster0.tm9qprm.mongodb.net/oharatcg?retryWrites=true&w=majority&appName=Cluster0
ENV GOOGLE_ID $GOOGLEID
ENV DATABASE_URL $DATABASEURL
ENV DISCORD_CLIENT_ID $DISCORDCLIENTID
ENV DISCORD_CLIENT_SECRET $DISCORDCLIENTSECRET
ENV GOOGLE_SECRET $GOOGLESECRET

RUN npm run build

CMD ["npm", "start"]
