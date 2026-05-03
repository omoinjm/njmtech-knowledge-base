# Use a multi-stage build to create a lean final image.
# Stage 1: Build the Go application
FROM golang:1.25-alpine AS builder

# Install necessary dependencies: git for fetching Go modules,
# and build-base for cgo if any dependencies require it.
RUN apk add --no-cache git build-base

# Set the working directory inside the container.
WORKDIR /app

# Copy go.mod and go.sum to download dependencies first,
# leveraging Docker's layer caching. NOTE: when enabling build-tags that pull
# additional imports, it's safer to run 'go mod download' after copying the full
# source so the module graph includes all build-tagged files.
COPY go.mod go.sum ./

# Copy the rest of the application's source code.
COPY . .

# Add the Infisical SDK to the module graph and download dependencies.
RUN go get github.com/infisical/go-sdk@v0.7.1
RUN go mod download

# Build the Go application with the 'infisical' build tag (Infisical provider compiled in).
# -ldflags="-w -s" strips debug information, reducing the binary size.
# CGO_ENABLED=0 disables cgo, creating a static binary.
RUN CGO_ENABLED=0 go build -tags=infisical -ldflags="-w -s" -o /yt-transcribe .

# Stage 2: Create the final, minimal image
FROM alpine:3.21

# Install runtime dependencies: ffmpeg, curl, cmake, build-base, python3, busybox-extras.
# cmake and build-base are needed for building whisper.cpp.
# python3 is required by yt-dlp.
# busybox-extras provides crond for scheduling cron jobs.
RUN apk add --no-cache ffmpeg curl cmake build-base git python3 busybox-extras

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

# Set the entrypoint to manage cron scheduling.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]