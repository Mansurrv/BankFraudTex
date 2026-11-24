FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /orbit ./cmd/orbit

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -H -u 10001 orbit
COPY --from=build /orbit /usr/local/bin/orbit
USER orbit
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/orbit"]
