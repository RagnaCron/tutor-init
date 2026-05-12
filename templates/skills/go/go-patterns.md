---
name: go-patterns
description: >
  Idiomatic Go patterns and best practices used to inform planning and TODO
  generation. Activated when planning Go features, reviewing Go architecture,
  or producing Go code via the boring-code skill. Does not produce code on
  its own — translates pattern knowledge into concrete task guidance.
---

# Go Patterns — Tutor Reference

You are in tutor mode. This skill is a reference, not a code generator.
Use the patterns below to inform TODO items in feature plans, to flag
anti-patterns in architectural discussions, and to guide style when the
boring-code skill is active.

Do not produce code from this skill unprompted. When a pattern is relevant
to a plan, surface it as a TODO item or a Note — not as a code block.

## When to activate

- Planning a feature that involves Go-specific design decisions
- Reviewing or discussing Go architecture, package structure, or interfaces
- Generating TODO items that require Go-specific knowledge
- boring-code skill is active and needs style guidance

---

## How to use this in planning

Pattern knowledge translates into TODO items, not code. Examples:

| Situation                              | TODO item                                                              |
|----------------------------------------|------------------------------------------------------------------------|
| New dependency with optional behaviour | `TODO: use functional options pattern for optional config`             |
| Shared mutable state                   | `TODO: protect shared state with sync.Mutex or sync.RWMutex`           |
| Multiple goroutines returning errors   | `TODO: coordinate with errgroup.WithContext, cancel on first error`    |
| Function takes a concrete type         | `TODO: accept io.Reader / io.Writer instead of concrete type`          |
| Package-level var holding state        | `TODO: move to struct field, inject as dependency`                     |
| Error returned without context         | `TODO: wrap with fmt.Errorf("operation context: %w", err)`             |
| Slice built in a loop                  | `TODO: preallocate with make([]T, 0, len(input))`                      |
| New server or client constructor       | `TODO: apply functional options for optional fields, sensible defaults`|

Surface these as TODO items in feature plans. Do not write the implementation.

---

## Core principles

### Simplicity and clarity

Go favours simplicity over cleverness. When planning, default to the
straightforward approach. Flag cleverness as a risk in Notes.

```go
// Good: Clear and direct
func GetUser(id string) (*User, error) {
    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return user, nil
}

// Bad: Overly clever
func GetUser(id string) (*User, error) {
    return func() (*User, error) {
        if u, e := db.FindUser(id); e == nil {
            return u, nil
        } else {
            return nil, e
        }
    }()
}
```

The idiomatic form: early returns, flat structure, named results only when
they aid clarity, errors handled immediately where they occur.

### Make the zero value useful

Design types so their zero value is immediately usable. Flag types that
require initialisation before use — they are a source of nil panics and
should be a TODO to fix.

```go
// Good: Zero value is useful
type Counter struct {
    mu    sync.Mutex
    count int // zero value is 0, ready to use
}

func (c *Counter) Inc() {
    c.mu.Lock()
    c.count++
    c.mu.Unlock()
}

// Good: bytes.Buffer works with zero value
var buf bytes.Buffer
buf.WriteString("hello")

// Bad: Requires initialization
type BadCounter struct {
    counts map[string]int // nil map will panic
}
```

### Accept interfaces, return structs

Functions should accept interface parameters and return concrete types.
When planning, flag any function that accepts a concrete type where an
interface would do — it is a testability problem.

```go
// Good: Accepts interface, returns concrete type
func ProcessData(r io.Reader) (*Result, error) {
    data, err := io.ReadAll(r)
    if err != nil {
        return nil, err
    }
    return &Result{Data: data}, nil
}

// Bad: Returns interface (hides implementation details unnecessarily)
func ProcessData(r io.Reader) (io.Reader, error) {
    // ...
}
```

---

## Error handling patterns

### Wrap errors with context

Every error that crosses a function boundary should carry context. When
planning, include a TODO for error wrapping whenever a new function boundary
is introduced.

```go
// Good: Wrap errors with context
func LoadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("load config %s: %w", path, err)
    }

    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config %s: %w", path, err)
    }

    return &cfg, nil
}
```

### Custom error types and sentinel errors

Use sentinel errors for known, checkable conditions. Use custom types when
the caller needs structured data from the error. When planning a new domain
package, include a TODO to define its error vocabulary early.

```go
// Define domain-specific errors
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation failed on %s: %s", e.Field, e.Message)
}

// Sentinel errors for common cases
var (
    ErrNotFound     = errors.New("resource not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrInvalidInput = errors.New("invalid input")
)
```

### errors.Is and errors.As

Plan callers to use `errors.Is` for sentinel checks and `errors.As` for
typed checks. Flag any code that does direct string comparison on errors.

```go
func HandleError(err error) {
    // Check for specific error
    if errors.Is(err, sql.ErrNoRows) {
        log.Println("No records found")
        return
    }

    // Check for error type
    var validationErr *ValidationError
    if errors.As(err, &validationErr) {
        log.Printf("Validation error on field %s: %s",
            validationErr.Field, validationErr.Message)
        return
    }

    // Unknown error
    log.Printf("Unexpected error: %v", err)
}
```

### Never ignore errors

Flag blank-identifier error suppression as a TODO in any plan or review.
The only acceptable ignore is best-effort cleanup — and it should be
documented inline.

```go
// Bad: Ignoring error with blank identifier
result, _ := doSomething()

// Good: Handle or explicitly document why it's safe to ignore
result, err := doSomething()
if err != nil {
    return err
}

// Acceptable: When error truly doesn't matter (rare)
_ = writer.Close() // Best-effort cleanup, error logged elsewhere
```

---

## Concurrency patterns

### Worker pool

When planning concurrent work over a collection, default to a worker pool.
TODO items: define job and result types, size the pool, close results when
workers are done.

```go
func WorkerPool(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup

    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }()
    }

    wg.Wait()
    close(results)
}
```

### Context for cancellation and timeouts

Every operation that touches the network, disk, or a downstream service
should accept and respect a `context.Context`. When planning, include TODOs
to thread context through the call chain and to set appropriate timeouts.

```go
func FetchWithTimeout(ctx context.Context, url string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, fmt.Errorf("create request: %w", err)
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("fetch %s: %w", url, err)
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}
```

### errgroup for coordinated goroutines

When multiple goroutines must all succeed or the first failure should
cancel the rest, plan for `golang.org/x/sync/errgroup`. TODO: import
errgroup, use `errgroup.WithContext`, capture loop variables before
launching goroutines.

```go
func FetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([][]byte, len(urls))
    for i, url := range urls {
        i, url := i, url // capture loop variables
        g.Go(func() error {
            data, err := FetchWithTimeout(ctx, url)
            if err != nil {
                return err
            }
            results[i] = data
            return nil
        })
    }
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

### Graceful shutdown

When planning an HTTP server or long-running process, include a TODO for
graceful shutdown: trap SIGINT/SIGTERM, call `server.Shutdown` with a
timeout context, wait for in-flight requests.

```go
func GracefulShutdown(server *http.Server) {
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

    <-quit
    log.Println("Shutting down server...")

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Fatalf("Server forced to shutdown: %v", err)
    }

    log.Println("Server exited")
}
```

### Avoiding goroutine leaks

Flag any goroutine that sends to an unbuffered channel without a select on
`ctx.Done()` — it will leak if the receiver goes away. Plan buffered channels
or select-with-cancel for any goroutine that outlives its caller.

```go
// Bad: Goroutine leak if context is cancelled
func leakyFetch(ctx context.Context, url string) <-chan []byte {
    ch := make(chan []byte)
    go func() {
        data, _ := fetch(url)
        ch <- data // Blocks forever if no receiver
    }()
    return ch
}

// Good: Properly handles cancellation
func safeFetch(ctx context.Context, url string) <-chan []byte {
    ch := make(chan []byte, 1) // Buffered channel
    go func() {
        data, err := fetch(url)
        if err != nil {
            return
        }
        select {
        case ch <- data:
        case <-ctx.Done():
        }
    }()
    return ch
}
```

---

## Interface design

### Small, focused interfaces

Prefer single-method interfaces. Compose them when needed. When planning a
new abstraction, start with the smallest interface that satisfies the current
requirement — do not design for hypothetical future callers.

```go
// Good: Single-method interfaces
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

// Compose interfaces as needed
type ReadWriteCloser interface {
    Reader
    Writer
    Closer
}
```

### Define interfaces where they are used

Interfaces belong in the consumer package, not the provider. When planning
a new service that depends on a repository, include a TODO to define the
interface in the service package — not in the repository package.

```go
// In the consumer package, not the provider
package service

// UserStore defines what this service needs
type UserStore interface {
    GetUser(id string) (*User, error)
    SaveUser(user *User) error
}

type Service struct {
    store UserStore
}

// Concrete implementation can be in another package
// It doesn't need to know about this interface
```

### Optional behaviour with type assertions

When a behaviour is optional, use a type assertion rather than adding a
method to the primary interface. Flag any interface that grows a method
purely to support one caller.

```go
type Flusher interface {
    Flush() error
}

func WriteAndFlush(w io.Writer, data []byte) error {
    if _, err := w.Write(data); err != nil {
        return err
    }

    // Flush if supported
    if f, ok := w.(Flusher); ok {
        return f.Flush()
    }
    return nil
}
```

---

## Package organisation

### Standard project layout

When planning a new project or a significant restructuring, default to:

```
myproject/
├── cmd/
│   └── myapp/
│       └── main.go           # Entry point
├── internal/
│   ├── handler/              # HTTP handlers
│   ├── service/              # Business logic
│   ├── repository/           # Data access
│   └── config/               # Configuration
├── pkg/
│   └── client/               # Public API client
├── api/
│   └── v1/                   # API definitions (proto, OpenAPI)
├── testdata/                 # Test fixtures
├── go.mod
├── go.sum
└── Makefile
```

Flag any business logic in `main.go` or any database calls in handlers as
a TODO to relocate.

### Package naming

Short, lowercase, no underscores, no redundant suffixes. `user` not
`userService`. `handler` not `httpHandler`. Flag packages with mixed-case
or underscore names as a TODO to rename.

```go
// Good: Short, lowercase, no underscores
package http
package json
package user

// Bad: Verbose, mixed case, or redundant
package httpHandler
package json_parser
package userService // Redundant 'Service' suffix
```

### Avoid package-level state

Flag any package-level `var` that holds mutable state. Plan to move it into
a struct and inject it as a dependency. `func init()` that initialises
shared state is a specific pattern to flag.

```go
// Bad: Global mutable state
var db *sql.DB

func init() {
    db, _ = sql.Open("postgres", os.Getenv("DATABASE_URL"))
}

// Good: Dependency injection
type Server struct {
    db *sql.DB
}

func NewServer(db *sql.DB) *Server {
    return &Server{db: db}
}
```

---

## Struct design

### Functional options pattern

Use functional options for structs with optional configuration and sensible
defaults. When planning a new server, client, or configurable component,
include a TODO to apply this pattern.

```go
type Server struct {
    addr    string
    timeout time.Duration
    logger  *log.Logger
}

type Option func(*Server)

func WithTimeout(d time.Duration) Option {
    return func(s *Server) {
        s.timeout = d
    }
}

func WithLogger(l *log.Logger) Option {
    return func(s *Server) {
        s.logger = l
    }
}

func NewServer(addr string, opts ...Option) *Server {
    s := &Server{
        addr:    addr,
        timeout: 30 * time.Second, // default
        logger:  log.Default(),    // default
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

// Usage
server := NewServer(":8080",
    WithTimeout(60*time.Second),
    WithLogger(customLogger),
)
```

### Embedding for composition

Use embedding to compose behaviours. Flag deep inheritance-style struct
hierarchies as a design smell — prefer composition.

```go
type Logger struct {
    prefix string
}

func (l *Logger) Log(msg string) {
    fmt.Printf("[%s] %s\n", l.prefix, msg)
}

type Server struct {
    *Logger // Embedding - Server gets Log method
    addr    string
}

func NewServer(addr string) *Server {
    return &Server{
        Logger: &Logger{prefix: "SERVER"},
        addr:   addr,
    }
}

// Usage
s := NewServer(":8080")
s.Log("Starting...") // Calls embedded Logger.Log
```

---

## Memory and performance

Include these as TODOs only when the plan involves performance-critical code.
Do not add performance TODOs speculatively.

### Preallocate Slices When Size is Known

```go
// Bad: Grows slice multiple times
func processItems(items []Item) []Result {
    var results []Result
    for _, item := range items {
        results = append(results, process(item))
    }
    return results
}

// Good: Single allocation
func processItems(items []Item) []Result {
    results := make([]Result, 0, len(items))
    for _, item := range items {
        results = append(results, process(item))
    }
    return results
}
```

### Use sync.Pool for Frequent Allocations

```go
var bufferPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

func ProcessRequest(data []byte) []byte {
    buf := bufferPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufferPool.Put(buf)
    }()

    buf.Write(data)
    // Process...
    return buf.Bytes()
}
```

### Avoid String Concatenation in Loops

```go
// Bad: Creates many string allocations
func join(parts []string) string {
    var result string
    for _, p := range parts {
        result += p + ","
    }
    return result
}

// Good: Single allocation with strings.Builder
func join(parts []string) string {
    var sb strings.Builder
    for i, p := range parts {
        if i > 0 {
            sb.WriteString(",")
        }
        sb.WriteString(p)
    }
    return sb.String()
}

// Best: Use standard library
func join(parts []string) string {
    return strings.Join(parts, ",")
}
```

---

## Go tooling reference

For TODO items that involve tooling, use these standard commands:

### Essential Commands

```
# Build and run
go build ./...
go run ./cmd/myapp

# Testing
go test ./...
go test -race ./...
go test -cover ./...

# Static analysis
go vet ./...
staticcheck ./...
golangci-lint run

# Module management
go mod tidy
go mod verify

# Formatting
gofmt -w .
goimports -w .

```

### Recommended Linter Configuration (.golangci.yml)

```yml
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - unused
    - gofmt
    - goimports
    - misspell
    - unconvert
    - unparam

linters-settings:
  errcheck:
    check-type-assertions: true
  govet:
    check-shadowing: true

issues:
  exclude-use-default: false
```

---

## Anti-patterns — flag these in plans and reviews

| Anti-pattern                          | TODO                                              |
|---------------------------------------|---------------------------------------------------|
| Naked returns in long functions       | Remove named returns or shorten the function      |
| `panic` for control flow              | Return an error instead                           |
| `context.Context` stored in a struct  | Pass context as the first function parameter      |
| Mixed value and pointer receivers     | Pick one and be consistent across the type        |
| Error ignored with `_`               | Handle or document explicitly                     |
| Goroutine without cancellation path   | Add `select` on `ctx.Done()`                      |
| Package-level mutable state           | Move into struct, inject as dependency            |
| Concrete type accepted, interface fits| Accept the interface instead                      |
| String concatenation in loop          | Use `strings.Builder` or `strings.Join`           |

```go
// Bad: Naked returns in long functions
func process() (result int, err error) {
    // ... 50 lines ...
    return // What is being returned?
}

// Bad: Using panic for control flow
func GetUser(id string) *User {
    user, err := db.Find(id)
    if err != nil {
        panic(err) // Don't do this
    }
    return user
}

// Bad: Passing context in struct
type Request struct {
    ctx context.Context // Context should be first param
    ID  string
}

// Good: Context as first parameter
func ProcessRequest(ctx context.Context, id string) error {
    // ...
}

// Bad: Mixing value and pointer receivers
type Counter struct{ n int }
func (c Counter) Value() int { return c.n }    // Value receiver
func (c *Counter) Increment() { c.n++ }        // Pointer receiver
// Pick one style and be consistent
```

---

## Quick reference: Go idioms

| Idiom                                  | Implication for planning                        |
|----------------------------------------|-------------------------------------------------|
| Errors are values                      | Plan explicit error paths, not exception flows  |
| Accept interfaces, return structs      | Plan for testability at every boundary          |
| Make the zero value useful             | Plan types that do not require initialisation   |
| Clear is better than clever            | Flag clever solutions as a risk in Notes        |
| A little copying beats a dependency   | Question every new import in a plan             |
| Don't communicate by sharing memory   | Plan channels for coordination, not shared vars |

**Remember:** Go code should be boring in the best way — predictable,
consistent, and easy to understand. Surface this standard in every plan.
