// Package db owns the MongoDB connection, collection names and indexes.
package db

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	Users         = "users"
	RefreshTokens = "refresh_tokens"
	Devices       = "devices"
	Notifications = "notifications"
	Parsers       = "parser_templates"
	OTPs          = "otps"
)

// SyncCollections are the per-user document collections that the mobile app syncs.
var SyncCollections = []string{"accounts", "transactions", "budgets", "debts", "goals", "bills"}

type Store struct {
	Client *mongo.Client
	DB     *mongo.Database
}

func Connect(ctx context.Context, uri, name string) (*Store, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	cl, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).SetServerSelectionTimeout(10*time.Second))
	if err != nil {
		return nil, err
	}
	if err := cl.Ping(ctx, nil); err != nil {
		return nil, err
	}
	return &Store{Client: cl, DB: cl.Database(name)}, nil
}

func (s *Store) Col(name string) *mongo.Collection { return s.DB.Collection(name) }

func (s *Store) Close(ctx context.Context) error { return s.Client.Disconnect(ctx) }

func (s *Store) Ping(ctx context.Context) error { return s.Client.Ping(ctx, nil) }

func strType(field string) bson.D {
	return bson.D{{Key: field, Value: bson.D{{Key: "$type", Value: "string"}}}}
}

// EnsureIndexes is idempotent and safe to run on every start.
func (s *Store) EnsureIndexes(ctx context.Context) error {
	uniq := func(keys bson.D, partial bson.D) mongo.IndexModel {
		o := options.Index().SetUnique(true)
		if partial != nil {
			o.SetPartialFilterExpression(partial)
		}
		return mongo.IndexModel{Keys: keys, Options: o}
	}
	plan := map[string][]mongo.IndexModel{
		Users: {
			uniq(bson.D{{Key: "email", Value: 1}}, strType("email")),
			uniq(bson.D{{Key: "phone", Value: 1}}, strType("phone")),
		},
		RefreshTokens: {
			uniq(bson.D{{Key: "hash", Value: 1}}, nil),
			{Keys: bson.D{{Key: "expiresAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
			{Keys: bson.D{{Key: "userId", Value: 1}}},
		},
		Devices:       {uniq(bson.D{{Key: "userId", Value: 1}, {Key: "token", Value: 1}}, nil)},
		Notifications: {uniq(bson.D{{Key: "userId", Value: 1}, {Key: "key", Value: 1}}, nil)},
		Parsers:       {uniq(bson.D{{Key: "bankCode", Value: 1}}, nil)},
		OTPs: {
			uniq(bson.D{{Key: "email", Value: 1}}, nil),
			{Keys: bson.D{{Key: "purgeAt", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
		},
	}
	for _, c := range SyncCollections {
		plan[c] = []mongo.IndexModel{
			uniq(bson.D{{Key: "userId", Value: 1}, {Key: "id", Value: 1}}, nil),
			{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "syncedAt", Value: 1}}},
		}
	}
	plan["transactions"] = append(plan["transactions"],
		mongo.IndexModel{Keys: bson.D{{Key: "userId", Value: 1}, {Key: "occurredAt", Value: -1}}},
		uniq(bson.D{{Key: "userId", Value: 1}, {Key: "dedupeHash", Value: 1}}, strType("dedupeHash")),
	)
	for name, models := range plan {
		if _, err := s.Col(name).Indexes().CreateMany(ctx, models); err != nil {
			return err
		}
	}
	return nil
}
