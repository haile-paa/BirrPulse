// Command seed inserts the default bank list into MongoDB without touching banks that already exist.
// Run it once after the first deploy:  go run ./cmd/seed
package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/config"
	"birrpulse/internal/db"
)

//go:embed parsers.json
var defaults []byte

func main() {
	config.LoadEnvFile() // use the same backend/.env as the server
	uri, name := os.Getenv("MONGO_URI"), os.Getenv("MONGO_DB")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}
	if name == "" {
		name = "birrpulse"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store, err := db.Connect(ctx, uri, name)
	if err != nil {
		log.Fatalf("cannot reach MongoDB at %s: %v\nStart MongoDB (or `docker compose up -d mongo`) and check MONGO_URI in backend/.env", uri, err)
	}
	defer store.Close(ctx)
	if err := store.EnsureIndexes(ctx); err != nil {
		log.Fatal(err)
	}
	var banks []map[string]any
	if err := json.Unmarshal(defaults, &banks); err != nil {
		log.Fatal(err)
	}
	for _, b := range banks {
		b["version"], b["updatedAt"] = 1, time.Now().UnixMilli()
		res, err := store.Col(db.Parsers).UpdateOne(ctx, bson.M{"bankCode": b["bankCode"]}, bson.M{"$setOnInsert": b}, options.Update().SetUpsert(true))
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%-9v inserted=%v\n", b["bankCode"], res.UpsertedCount == 1)
	}
}
