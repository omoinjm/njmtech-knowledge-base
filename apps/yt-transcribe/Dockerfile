# Use a multi-stage build to create a lean final image.
# Stage 1: Build the Go application
FROM golang:1.25.5-alpine3.21 AS builder

# Install necessary dependencies: git for fetching Go modules,
# and build-base for cgo if any dependencies require it.
RUN apk add --no-cache git build-base

# Set the working directory inside the container.
WORKDIR /app

# The build environment used here cannot reach proxy.golang.org over IPv6.
# Fetch modules directly from their source repositories instead of relying on
# the public Go proxy / checksum service.
ENV GOPROXY=direct
ENV GOSUMDB=off

# Copy go.mod and go.sum first so the module graph can be resolved before the
# rest of the source is added.
COPY go.mod go.sum ./

# Download only the build-time dependency graph (does not fetch test-only deps
# of transitive packages, unlike `go mod tidy`). This also improves caching:
# the layer is invalidated only when go.mod or go.sum changes.
RUN go mod download

# Copy the rest of the application's source code.
COPY . .

# Build the Go application with the 'infisical' build tag (Infisical provider compiled in).
# -ldflags="-w -s" strips debug information, reducing the binary size.
# CGO_ENABLED=0 disables cgo, creating a static binary.
RUN CGO_ENABLED=0 go build -tags=infisical -ldflags="-w -s" -o /yt-transcribe .

# Stage 2: Create the final, minimal image
FROM alpine:3.21

# Install runtime dependencies: ffmpeg, curl, cmake, build-base, python3, nodejs.
# cmake and build-base are needed for building whisper.cpp.
# python3 is required by yt-dlp.
RUN apk add --no-cache ffmpeg curl cmake build-base git python3 nodejs

# Install yt-dlp from the latest release.
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Install and build whisper.cpp from a pinned release tag.
RUN git clone --depth 1 --branch v1.8.4 https://github.com/ggml-org/whisper.cpp.git /whisper.cpp && \
    cd /whisper.cpp && \
    sh ./models/download-ggml-model.sh base.en && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build -j && \
    cp build/bin/whisper-cli /usr/local/bin/whisper-cli

# Copy the built Go binary from the builder stage.
COPY --from=builder /yt-transcribe /usr/local/bin/

# Copy the entrypoint script and make it executable.
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set the entrypoint so Cloudflare Containers can run either the HTTP server
# or a one-off batch job by passing CLI flags through the same image.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
