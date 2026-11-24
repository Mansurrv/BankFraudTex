package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"orbit/internal/api"
	"orbit/internal/store"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func openStore(ctx context.Context, url, dataDir string, log *slog.Logger) (*store.Store, error) {
	if url == "" {
		return store.Open(ctx, url, dataDir)
	}
	waiting := false
	for {
		attempt, cancel := context.WithTimeout(ctx, 4*time.Second)
		db, err := store.Open(attempt, url, dataDir)
		cancel()
		if err == nil {
			return db, nil
		}
		var network *net.OpError
		var postgres *pgconn.PgError
		if !errors.As(err, &network) && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) &&
			!errors.Is(err, context.DeadlineExceeded) &&
			!(errors.As(err, &postgres) && (postgres.Code == "57P03" || postgres.Code == "57P01")) {
			return nil, err
		}
		if !waiting {
			log.Info("waiting for PostgreSQL")
			waiting = true
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
}

func run(log *slog.Logger) error {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	startup, done := context.WithTimeout(ctx, 45*time.Second)
	defer done()
	databaseURL := os.Getenv("DATABASE_URL")
	dataDir := env("ORBIT_DATA_DIR", ".orbit")
	db, err := openStore(startup, databaseURL, dataDir, log)
	if err != nil {
		return err
	}
	defer db.Close()
	domain := os.Getenv("ORBIT_CORPORATE_DOMAIN")
	registration := api.ClosedRegistration(domain)
	if os.Getenv("ORBIT_REGISTRATION_DISABLED") != "true" {
		registration, err = api.SMTPRegistration(domain, os.Getenv("ORBIT_SMTP_ADDR"), os.Getenv("ORBIT_SMTP_FROM"), os.Getenv("ORBIT_SMTP_USERNAME"), os.Getenv("ORBIT_SMTP_PASSWORD"))
		if err != nil {
			return err
		}
	}
	address := env("ORBIT_ADDR", "127.0.0.1:8081")
	secure := os.Getenv("ORBIT_SECURE_COOKIES") == "true"
	defaultLocal := !secure && registration.Domain == "" && address == "127.0.0.1:8081"
	localTest := os.Getenv("ORBIT_LOCAL_TEST") == "true" || (os.Getenv("ORBIT_LOCAL_TEST") == "" && defaultLocal)
	host, _, _ := net.SplitHostPort(address)
	loopback := net.ParseIP(host).IsLoopback()
	localInbox := os.Getenv("ORBIT_LOCAL_REGISTRATION")
	if localInbox == "true" || localInbox == "" && defaultLocal && localTest {
		if !localTest || secure || registration.Domain != "" || !loopback {
			return errors.New("the test inbox requires a loopback-only local API")
		}
		registration = api.LocalRegistration()
	}
	accounts := os.Getenv("ORBIT_USERS")
	if localTest && loopback && databaseURL == "" && accounts == "" {
		config, err := os.ReadFile(filepath.Join(dataDir, "local-users.json"))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		accounts = string(config)
	}
	if localTest && accounts != "" && !loopback {
		return errors.New("configured local accounts require a loopback-only API")
	}
	identity, err := api.NewIdentity(accounts, localTest, secure, os.Getenv("ORBIT_ORIGIN"), registration)
	if err != nil {
		return err
	}
	projection := store.Projection{URL: os.Getenv("NEO4J_URL"), User: env("NEO4J_USER", "neo4j"), Password: os.Getenv("NEO4J_PASSWORD")}
	app, err := api.New(startup, db, projection, api.Analytics{URL: os.Getenv("ANALYTICS_URL")}, identity, env("ORBIT_BRAND", "FFBI"), log)
	if err != nil {
		return err
	}
	go app.SyncProjection(ctx)
	server := &http.Server{
		Addr: address, Handler: app, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 20 * time.Second, WriteTimeout: 35 * time.Second, IdleTimeout: 65 * time.Second, MaxHeaderBytes: 32 << 10,
	}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 4*time.Second)
		defer cancel()
		if server.Shutdown(shutdown) != nil {
			_ = server.Close()
		}
	}()
	log.Info("orbit API listening", "address", server.Addr)
	if err = server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := run(log); err != nil {
		log.Error("startup or runtime failure", "error", err)
		os.Exit(1)
	}
}
