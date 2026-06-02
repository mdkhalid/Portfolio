require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Article = require('./models/Article');

const SOLID_ARTICLE = {
  title: 'SOLID Principles: 18 Years of Lessons From the Trenches',
  slug: 'solid-principles-18-years-of-lessons',
  excerpt: 'After 18 years of building enterprise systems in .NET, Angular and Azure, here is the field-tested version of SOLID: the parts that age well, the parts teams over-apply, and the five anti-patterns I still see in code review.',
  coverImage: '/blog/solid-cover.svg',
  tags: ['SOLID', 'Architecture', 'Design Principles', '.NET', 'Best Practices'],
  published: true,
  content: `# SOLID Principles: 18 Years of Lessons From the Trenches

I have been writing C# and shipping enterprise software since the .NET 1.1 days. I have seen SOLID go from "Uncle Bob's blog post nobody read" to "law carved in stone on every interview whiteboard." Both extremes are wrong.

The five principles are not a religion. They are a set of trade-offs that, applied with judgement, keep a system alive for the ten years a business expects from it. Applied without judgement, they turn a 50-line feature into a 500-line ceremony of interfaces and factories for one and a half users.

This post is the version of SOLID I wish I had on day one. Real code, the bugs they prevented, the over-engineering they caused, and the order I actually apply them when I open a pull request.

## Why SOLID still matters in 2026

Cloud-native, microservices, serverless, AI agents — none of these eliminated the underlying problem SOLID addresses: **change is the only constant, and change is cheapest when your code has clear seams.**

\`\`\`mermaid
flowchart LR
    A[New requirement] --> B{Is the code SOLID?}
    B -- Yes --> C[Small, surgical change]
    B -- No --> D[Rewrite the surrounding mess]
    C --> E[Shipped in days]
    D --> F[Shipped in weeks, breaks something else]
    style B fill:#f97316,stroke:#fb923c,color:#fff
    style C fill:#10b98120,stroke:#10b981
    style D fill:#ef444420,stroke:#ef4444
\`\`\`

The five letters are an acronym Robert C. Martin coined in the early 2000s. The acronym is convenient. The actual content is older than that — it draws on work by Bertrand Meyer (OCP), Barbara Liskov (LSP), and the structured design movement of the 1970s. If you have ever debugged a monolith at 2 a.m., you already know why it matters.

---

## S — Single Responsibility Principle

> A class should have one, and only one, reason to change.

A "reason to change" maps to an **actor** — a stakeholder who can force a change in the code. The billing department and the marketing department are different actors. If a single class changes when either of them wants something, that class has at least two responsibilities, regardless of how clean the methods look.

### Real-world metaphor

A restaurant has a chef, a cashier, and a dishwasher. Putting all three roles in one person is technically a working system — until any of the three jobs changes. The cashier gets a new POS terminal? The chef is now also expected to learn it. The dishwasher leaves? The chef leaves with them.

### The smell

\`\`\`csharp
public class InvoiceService
{
    public void CreateInvoice(Order order)
    {
        // 1. Validate the order
        if (order.Items.Count == 0) throw new InvalidOperationException();

        // 2. Persist to the database
        using var conn = new SqlConnection(_connectionString);
        conn.Open();
        // ... insert into Invoices, InvoiceItems tables

        // 3. Generate the PDF
        var pdf = PdfRenderer.Render(order);

        // 4. Send it by email
        var smtp = new SmtpClient("smtp.acme.com");
        smtp.Send("billing@acme.com", order.Customer.Email, "Your invoice", "", pdf);

        // 5. Update the dashboard cache
        _redis.SetAsync("dashboard:revenue", ComputeRevenue());
    }
}
\`\`\`

This class has four reasons to change: data access rules, PDF layout, email provider, and dashboard schema. I have shipped code that looked exactly like this. The first time the email provider changed, the entire deployment broke because the database call above it needed a connection string that had rotated.

### The refactor

\`\`\`csharp
public class InvoiceService
{
    public Invoice Create(Order order) => _repository.Save(Invoice.From(order));
}

public class InvoicePdfRenderer          { public byte[] Render(Invoice i) => /* ... */ }
public class InvoiceEmailSender          { public Task Send(Invoice i, byte[] pdf) => /* ... */ }
public class InvoiceDashboardProjector   { public Task Project(Invoice i) => /* ... */ }
public class CreateInvoiceHandler
{
    public async Task Handle(Order order)
    {
        var invoice = _invoices.Create(order);
        await _email.Send(invoice, _pdf.Render(invoice));
        await _dashboard.Project(invoice);
    }
}
\`\`\`

Each class now has one actor. The PDF layout changes? Touch \`InvoicePdfRenderer\` only. The Redis key format changes? Touch the projector only.

### From the field

I once inherited a 4,000-line \`OrderService\` that did exactly what \`InvoiceService\` does above — and also generated shipping labels, called the loyalty API, and exported to Excel. Splitting it took three weeks. The bug count in the next two quarters dropped by 70%. That is the SRP business case, not the philosophical one.

---

## O — Open/Closed Principle

> Software entities should be open for extension, but closed for modification.

You should be able to add new behaviour without editing the code that already works and is already tested. This is the principle that saves you from merge conflicts on a 200-person codebase.

### Real-world metaphor

A power strip with universal sockets. You do not cut into the wall wiring to plug in a new appliance — you extend the strip. The wall is closed for modification. The strip is open for extension.

### The smell

\`\`\`csharp
public class DiscountCalculator
{
    public decimal Calculate(Order order, string customerType, string season)
    {
        decimal discount = 0;
        if (customerType == "Regular")    discount = order.Total * 0.05m;
        else if (customerType == "Premium") discount = order.Total * 0.10m;
        else if (customerType == "VIP")     discount = order.Total * 0.20m;
        if (season == "BlackFriday")        discount += 50;
        else if (season == "Christmas")     discount += 25;
        return discount;
    }
}
\`\`\`

Every new customer type or promotion edits the same method. Every edit risks breaking the cases you already had. I have seen a \`switch\` like this with 27 \`case\` arms and a bug that one team had carried for two years because nobody dared refactor it.

### The refactor

\`\`\`csharp
public interface IDiscountRule
{
    bool Applies(Order order);
    decimal Apply(Order order);
}

public class CustomerTypeDiscount : IDiscountRule
{
    private readonly CustomerType _type;
    private readonly decimal _rate;
    public CustomerTypeDiscount(CustomerType type, decimal rate) { _type = type; _rate = rate; }
    public bool Applies(Order order) => order.Customer.Type == _type;
    public decimal Apply(Order order) => order.Total * _rate;
}

public class SeasonalDiscount : IDiscountRule
{
    private readonly Season _season;
    private readonly decimal _amount;
    public bool Applies(Order order) => order.Season == _season;
    public decimal Apply(Order order) => _amount;
}

public class DiscountCalculator
{
    private readonly IEnumerable<IDiscountRule> _rules;
    public DiscountCalculator(IEnumerable<IDiscountRule> rules) => _rules = rules;
    public decimal Calculate(Order order) =>
        _rules.Where(r => r.Applies(order)).Sum(r => r.Apply(order));
}
\`\`\`

Adding a "Loyalty tier" rule is now one new class. The \`DiscountCalculator\` is closed.

\`\`\`mermaid
classDiagram
    class IDiscountRule {
        <<interface>>
        +Applies(Order) bool
        +Apply(Order) decimal
    }
    class CustomerTypeDiscount
    class SeasonalDiscount
    class LoyaltyTierDiscount
    class FirstTimeBuyerDiscount
    class DiscountCalculator {
        -IEnumerable~IDiscountRule~ rules
        +Calculate(Order) decimal
    }
    IDiscountRule <|.. CustomerTypeDiscount
    IDiscountRule <|.. SeasonalDiscount
    IDiscountRule <|.. LoyaltyTierDiscount
    IDiscountRule <|.. FirstTimeBuyerDiscount
    DiscountCalculator --> IDiscountRule
\`\`\`

### From the field

The biggest production win in my career came from applying OCP to a payment provider integration. We had six providers (Stripe, Adyen, PayPal, etc.) and a single 800-line \`PaymentProcessor\` with a giant \`switch\`. Each new region added a new arm and broke two existing ones. Refactoring to the strategy pattern took a sprint. Adding the seventh provider (a regional one) afterwards took 20 minutes. The estimated ROI for the refactor was six months. It paid back in three.

---

## L — Liskov Substitution Principle

> Objects of a superclass shall be replaceable with objects of a subclass without breaking the application.

The contract of a base type must be honoured by every subtype. If a caller can no longer rely on the base-type contract after a substitution, your inheritance is wrong.

### Real-world metaphor

If the contract for a \`Bird\` includes \`Fly()\`, then a \`Penguin\` is not a \`Bird\` — it is a flightless bird. Either the contract is wrong, or the hierarchy is.

### The smell

\`\`\`csharp
public class Rectangle
{
    public virtual int Width  { get; set; }
    public virtual int Height { get; set; }
    public int Area => Width * Height;
}

public class Square : Rectangle
{
    public override int Width  { set { base.Width = base.Height = value; } }
    public override int Height { set { base.Width = base.Height = value; } }
}

public void Resize(Rectangle r)
{
    r.Width = 5;
    r.Height = 10;
    Debug.Assert(r.Area == 50); // Passes for Rectangle, fails for Square
}
\`\`\`

The classic example, still relevant. The \`Square\` violates the contract that setting \`Width\` and \`Height\` independently preserves the rectangle.

### The refactor

\`\`\`csharp
public abstract class Shape
{
    public abstract int Area { get; }
}

public class Rectangle : Shape
{
    public int Width  { get; set; }
    public int Height { get; set; }
    public override int Area => Width * Height;
}

public class Square : Shape
{
    public int Side { get; set; }
    public override int Area => Side * Side;
}
\`\`\`

The base type no longer pretends both shapes have independent width and height. The contract is honest. Substitutability is preserved.

### The behavioural version of LSP

LSP is also about behaviour, not just signatures:

- **Preconditions cannot be strengthened** in a subtype. If the base accepts \`amount > 0\`, the subtype cannot throw on \`amount == 1\`.
- **Postconditions cannot be weakened**. If the base guarantees a saved record, the subtype must also save.
- **Invariants must be preserved**. A \`NonEmptyList\` subclass cannot suddenly allow empty.

I caught a violation of this in a fintech system where a \`PremiumAccount\` subclass of \`Account\` rejected withdrawals above 1,000 — but the base contract was "any positive amount." A code path trusted the base contract and was silently failing for premium users.

### From the field

Whenever I review a pull request that adds a new subclass, I ask one question: *can I delete the base class name from the variable type and the program still works?* If yes, the inheritance is sound. If no, you have an LSP violation that polymorphism will eventually turn into a production incident.

---

## I — Interface Segregation Principle

> No client should be forced to depend on methods it does not use.

Fat interfaces are the cause of the "stub-everything" anti-pattern in unit tests. They are also the cause of "I am not sure if changing this method will break someone" paralysis.

### Real-world metaphor

A restaurant menu is a single document, but you can order just the starter. Imagine if you had to order the entire menu to get a starter. That is what a fat interface feels like to a consumer.

### The smell

\`\`\`csharp
public interface IUserRepository
{
    User GetById(int id);
    void Save(User user);
    void Delete(int id);
    IReadOnlyList<User> ListAll();
    void SendWelcomeEmail(User user);
    byte[] ExportToCsv();
    Dictionary<string, int> GetStatistics();
}

public class AdminController
{
    private readonly IUserRepository _repo;
    public AdminController(IUserRepository repo) => _repo = repo;
    public IActionResult Stats() => Ok(_repo.GetStatistics());
}
\`\`\`

The controller only needs statistics. But it depends on the whole interface, so it gets dragged into every change to \`ExportToCsv\` and \`SendWelcomeEmail\`. Unit tests on \`AdminController\` need a stub that implements seven methods to verify one call.

### The refactor

\`\`\`csharp
public interface IUserReader       { User GetById(int id); IReadOnlyList<User> ListAll(); }
public interface IUserWriter       { void Save(User user); void Delete(int id); }
public interface IUserEmailer      { void SendWelcomeEmail(User user); }
public interface IUserExporter     { byte[] ExportToCsv(); }
public interface IUserStatsSource  { Dictionary<string, int> GetStatistics(); }

public class AdminController
{
    private readonly IUserStatsSource _stats;
    public AdminController(IUserStatsSource stats) => _stats = stats;
    public IActionResult Stats() => Ok(_stats.GetStatistics());
}
\`\`\`

The controller depends on one method. The stub for tests is one method. A change to \`ExportToCsv\` does not trigger a recompile of \`AdminController\`.

\`\`\`mermaid
flowchart TB
    subgraph "Before ISP"
        IR1[IUserRepository - 7 methods]
        AC1[AdminController] --> IR1
        WS1[WelcomeService] --> IR1
        EX1[ExportController] --> IR1
    end
    subgraph "After ISP"
        SR1[IUserStatsSource]
        SR2[IUserEmailer]
        SR3[IUserExporter]
        AC2[AdminController] --> SR1
        WS2[WelcomeService] --> SR2
        EX2[ExportController] --> SR3
    end
    style IR1 fill:#ef444420,stroke:#ef4444
    style SR1 fill:#10b98120,stroke:#10b981
    style SR2 fill:#10b98120,stroke:#10b981
    style SR3 fill:#10b98120,stroke:#10b981
\`\`\`

### From the field

The single most common LSP-and-ISP violation I see in Angular codebases: a single \`DataService\` class with 40 methods, all called from components that use one. Refactoring those to per-feature services with role interfaces is a one-sprint change that cuts the bundle size by 15-20% because of tree-shaking on the unused paths.

---

## D — Dependency Inversion Principle

> High-level modules should not depend on low-level modules. Both should depend on abstractions.

This is the principle people mix up with "use an IoC container." Dependency Inversion is about **who owns the interface definition**. The high-level policy owns it. The low-level detail implements it.

### Real-world metaphor

A wall socket (\`IOutlet\`) is owned by the electrical code, not by the toaster manufacturer. The toaster (\`high-level\`) does not depend on a specific power station (\`low-level\`). Both depend on the abstract "120V 60Hz" interface. You can swap the power station, the toaster still works.

### The smell

\`\`\`csharp
public class OrderService
{
    private readonly SqlOrderRepository _repo;
    private readonly SmtpEmailSender    _email;
    private readonly StripePaymentGateway _payments;

    public OrderService()
    {
        _repo      = new SqlOrderRepository(ConfigurationManager.ConnectionStrings["Db"].ConnectionString);
        _email     = new SmtpEmailSender("smtp.acme.com", 587, "user", "pass");
        _payments  = new StripePaymentGateway("sk_live_...");
    }

    public void Place(Order order) { /* uses concretes directly */ }
}
\`\`\`

Three problems:
1. **Untestable** — you cannot run \`OrderService\` without a real database, a real SMTP server, and real Stripe credentials.
2. **Undeployable** — moving from SQL to Cosmos, or Stripe to Adyen, means editing the class that holds the business rules.
3. **Unreadable** — the business logic is buried under infrastructure.

### The refactor

The high-level module owns the abstractions:

\`\`\`csharp
// Owned by the application layer, not the data layer
public interface IOrderRepository { Order Get(int id); void Save(Order o); }
public interface IEmailSender     { void Send(string to, string subject, string body); }
public interface IPaymentGateway  { PaymentResult Charge(Money amount, CardToken token); }

public class OrderService
{
    private readonly IOrderRepository _repo;
    private readonly IEmailSender     _email;
    private readonly IPaymentGateway  _payments;

    public OrderService(IOrderRepository repo, IEmailSender email, IPaymentGateway payments)
    {
        _repo = repo; _email = email; _payments = payments;
    }

    public Receipt Place(Order order)
    {
        var result = _payments.Charge(order.Total, order.PaymentToken);
        if (!result.Success) throw new PaymentFailedException();
        _repo.Save(order.MarkPaid());
        _email.Send(order.Customer.Email, "Order confirmed", order.Number);
        return new Receipt(order, result);
    }
}
\`\`\`

Composition root wires the concretes in \`Program.cs\`:

\`\`\`csharp
builder.Services.AddSingleton<IOrderRepository, SqlOrderRepository>();
builder.Services.AddSingleton<IEmailSender,     SmtpEmailSender>();
builder.Services.AddSingleton<IPaymentGateway,  StripePaymentGateway>();
builder.Services.AddScoped<OrderService>();
\`\`\`

The test for \`OrderService\` is now trivial:

\`\`\`csharp
[Fact]
public void Place_charges_then_saves_then_emails()
{
    var repo  = Substitute.For<IOrderRepository>();
    var email = Substitute.For<IEmailSender>();
    var pay   = Substitute.For<IPaymentGateway>();
    pay.Charge(Arg.Any<Money>(), Arg.Any<CardToken>())
       .Returns(PaymentResult.Ok("tx_123"));

    new OrderService(repo, email, pay).Place(sampleOrder);

    pay.Received(1).Charge(Arg.Any<Money>(), Arg.Any<CardToken>());
    repo.Received(1).Save(Arg.Is<Order>(o => o.Status == OrderStatus.Paid));
    email.Received(1).Send(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
}
\`\`\`

### From the field

The cleanest architecture I ever shipped was a logistics platform where every external system (carrier APIs, payment, email, push notifications, telemetry) was behind an interface owned by the application layer. We swapped two carriers mid-project when our pricing changed — about 200 lines of code in two new adapter classes, zero changes to the routing engine or the order pipeline. The team lead called it "the most boring migration we have ever done." Boring is the goal.

---

## How the five principles interlock

SOLID is not five independent rules. They form a dependency chain that goes from the smallest unit to the largest:

\`\`\`mermaid
flowchart TB
    SRP[SRP\nOne class, one actor] --> ISP[ISP\nSmall, focused interfaces]
    OCP[OCP\nExtend, do not edit] --> LSP[LSP\nSubtypes honour the contract]
    ISP --> DIP[DIP\nBoth sides depend on abstractions]
    LSP --> DIP
    SRP --> OCP
    DIP --> OUT[Composable, testable, changeable systems]
    OCP --> OUT
    style SRP fill:#f97316,color:#fff
    style OCP fill:#fb923c,color:#fff
    style LSP fill:#fbbf24
    style ISP fill:#34d399
    style DIP fill:#22d3ee
    style OUT fill:#0f172a,color:#f8fafc
\`\`\`

- **SRP** gives you small classes.
- **ISP** makes the public surface of those classes small.
- **OCP** keeps them stable while the system grows.
- **LSP** makes sure polymorphism does not silently break the system.
- **DIP** inverts ownership so the high-level policy is not dragged around by low-level changes.

Skip SRP, and the rest of the chain is hard to apply. Skip DIP, and your OCP is fighting against the compiler. They are a sequence, not a checklist.

---

## Five anti-patterns I still see in code review

These are the SOLID violations that show up in pull requests, in order of frequency:

### 1. The "manager" class

\`\`\`csharp
public class UserManager   // 1,200 lines
public class OrderManager  // 1,500 lines
public class ProductManager // 1,800 lines
\`\`\`

SRP violation. The name "Manager" is a tell. Split by actor. \`UserCreator\`, \`UserPasswordResetter\`, \`UserExporter\`.

### 2. The "god interface"

\`\`\`csharp
public interface IService { void Do(); void DoSomething(); void DoItAll(); }
\`\`\`

ISP violation. If a class implementing the interface throws \`NotImplementedException\` on any method, the interface is wrong.

### 3. The "if-else zoo"

\`\`\`csharp
if (type == "A") { /* 30 lines */ }
else if (type == "B") { /* 30 lines */ }
else if (type == "C") { /* 30 lines */ }
\`\`\`

OCP violation in disguise. Each new branch is a deployment risk. Replace with strategy + DI.

### 4. The "static-everything" helper

\`\`\`csharp
public static class EmailHelper
{
    public static void Send(string to, string body) {
        var smtp = new SmtpClient("smtp.acme.com");
        smtp.Send(...);
    }
}
\`\`\`

DIP violation disguised as convenience. Untestable, unconfigurable, and the day you need a second email provider you are rewriting every caller.

### 5. The "anemic subclass"

\`\`\`csharp
public class AdminUser : User
{
    public override void Login() => throw new NotSupportedException();
}
\`\`\`

LSP violation. The subclass broke the contract of the base. Promote behaviour to a \`CanLogin\` capability interface, drop the inheritance.

---

## A field checklist for your next pull request

Before you open that PR, walk through this:

1. **Can I describe this class in one sentence without using "and"?** If not, it has more than one responsibility.
2. **Does any consumer of this interface ignore more than half its methods?** If yes, the interface is too fat.
3. **If a new requirement came in tomorrow, would I edit a working class, or add a new one?** If you would edit, you are not at OCP.
4. **Can I delete the base type and the program still type-checks?** If not, your inheritance is leaking implementation.
5. **Can I write a unit test for this class without spinning up a database, network, or filesystem?** If not, your dependencies are pointing the wrong way.

If you answer "no" to any of them, do not merge yet. Refactor until you can answer "yes."

## Closing thoughts

I am not a SOLID purist. There are times when SRP is overkill for a 30-line script, when OCP is premature for a feature that will be used by one user, and when DIP is ceremony for code that will never have a second implementation.

The principles are **defaults, not laws**. They tell you what to do when you do not have a stronger reason. The art of senior engineering is knowing when the stronger reason applies. After 18 years, my defaults lean more aggressively toward SOLID than they did at year 5 — not because the principles got stricter, but because the systems I touch have been in production long enough that the cost of weak seams has become very visible.

Start with SRP. It is the only one that requires no abstractions and pays for itself on the next feature. The rest will follow.`,
};

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Article.findOneAndUpdate(
    { slug: SOLID_ARTICLE.slug },
    { $set: SOLID_ARTICLE },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Upserted article:');
  console.log('  id     :', result._id.toString());
  console.log('  title  :', result.title);
  console.log('  slug   :', result.slug);
  console.log('  tags   :', result.tags.join(', '));
  console.log('  cover  :', result.coverImage || '(none)');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
