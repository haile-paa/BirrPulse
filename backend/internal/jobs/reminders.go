// Package jobs runs background work such as bill and debt reminders.
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/db"
	"birrpulse/internal/push"
)

type Runner struct {
	Store  *db.Store
	Pusher push.Sender
	Log    *slog.Logger
}

func etb(minor int64) string { return fmt.Sprintf("ETB %.2f", float64(minor)/100) }

// Run checks for due bills and debts on every tick until ctx is cancelled.
func (r *Runner) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	r.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.tick(ctx)
		}
	}
}

// notifyOnce inserts a notification keyed per user so a reminder is only ever sent once.
func (r *Runner) notifyOnce(ctx context.Context, uid primitive.ObjectID, key, kind, title, body string) {
	res, err := r.Store.Col(db.Notifications).UpdateOne(ctx, bson.M{"userId": uid, "key": key},
		bson.M{"$setOnInsert": bson.M{"kind": kind, "title": title, "body": body, "at": time.Now(), "read": false}},
		options.Update().SetUpsert(true))
	if err != nil || res.UpsertedCount == 0 {
		return
	}
	cur, err := r.Store.Col(db.Devices).Find(ctx, bson.M{"userId": uid})
	if err != nil {
		return
	}
	var devs []struct {
		Token string `bson:"token"`
	}
	if cur.All(ctx, &devs) != nil || len(devs) == 0 {
		return
	}
	tokens := make([]string, len(devs))
	for i, d := range devs {
		tokens[i] = d.Token
	}
	invalid, err := r.Pusher.Send(ctx, tokens, title, body, map[string]string{"kind": kind, "key": key})
	if err != nil {
		r.Log.Warn("push failed", "err", err)
	}
	if len(invalid) > 0 { // drop tokens FCM says are no longer registered
		_, _ = r.Store.Col(db.Devices).DeleteMany(ctx, bson.M{"userId": uid, "token": bson.M{"$in": invalid}})
	}
}

func (r *Runner) tick(ctx context.Context) {
	horizon := time.Now().Add(36 * time.Hour).UnixMilli()

	cur, err := r.Store.Col("bills").Find(ctx, bson.M{"deleted": bson.M{"$ne": true}, "nextDue": bson.M{"$lt": horizon}})
	if err == nil {
		var bills []struct {
			UserID  primitive.ObjectID `bson:"userId"`
			ID      string             `bson:"id"`
			Name    string             `bson:"name"`
			Amount  int64              `bson:"amount"`
			NextDue int64              `bson:"nextDue"`
		}
		if cur.All(ctx, &bills) == nil {
			for _, b := range bills {
				when := "is due soon"
				if b.NextDue < time.Now().UnixMilli()-86400000 {
					when = "is overdue"
				}
				r.notifyOnce(ctx, b.UserID, fmt.Sprintf("bill-%s-%d", b.ID, b.NextDue), "bill", b.Name+" "+when, etb(b.Amount)+" to pay.")
			}
		}
	}

	cur, err = r.Store.Col("debts").Find(ctx, bson.M{"deleted": bson.M{"$ne": true}, "dueDate": bson.M{"$lt": horizon, "$ne": nil}})
	if err == nil {
		var debts []struct {
			UserID     primitive.ObjectID `bson:"userId"`
			ID         string             `bson:"id"`
			Direction  string             `bson:"direction"`
			Person     string             `bson:"person"`
			Principal  int64              `bson:"principal"`
			DueDate    int64              `bson:"dueDate"`
			Repayments []struct {
				Amount int64 `bson:"amount"`
			} `bson:"repayments"`
		}
		if cur.All(ctx, &debts) == nil {
			for _, d := range debts {
				out := d.Principal
				for _, p := range d.Repayments {
					out -= p.Amount
				}
				if out <= 0 {
					continue
				}
				title := "Repayment due to " + d.Person
				if d.Direction == "lent" {
					title = d.Person + " should repay you"
				}
				r.notifyOnce(ctx, d.UserID, fmt.Sprintf("debt-%s-%d", d.ID, d.DueDate), "debt", title, etb(out)+" outstanding.")
			}
		}
	}
}
