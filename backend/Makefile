.PHONY: run test tidy up seed
tidy:
	go mod tidy
run: tidy
	go run ./cmd/server
test:
	go test ./...
seed:
	go run ./cmd/seed
up:
	docker compose up --build
