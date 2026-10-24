FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg xvfb pulseaudio dbus ca-certificates tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app/capture-service
COPY capture-service/package*.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY capture-service/ ./
COPY js/captions.js js/capture-scene.js /app/js/
RUN useradd -m capture && chown -R capture:capture /app && mkdir -p /home/capture/.cache && cp -r /root/.cache/ms-playwright /home/capture/.cache/ && chown -R capture:capture /home/capture
USER capture
ENV PORT=8080 DISPLAY=:99 PULSE_SINK=capture
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["sh","/app/capture-service/start.sh"]
