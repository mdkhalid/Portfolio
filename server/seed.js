require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Profile = require('./models/Profile');
const Skill = require('./models/Skill');
const Experience = require('./models/Experience');
const Education = require('./models/Education');
const Certification = require('./models/Certification');
const Project = require('./models/Project');
const Article = require('./models/Article');
const Admin = require('./models/Admin');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Profile.deleteMany({}), Skill.deleteMany({}),
    Experience.deleteMany({}), Education.deleteMany({}),
    Certification.deleteMany({}), Project.deleteMany({}),
    Article.deleteMany({}), Admin.deleteMany({}),
  ]);

  // Profile
  await Profile.create({
    name: 'Mohammad Khalid',
    email: 'khalid_bib@yahoo.com',
    phone: '9811291878',
    location: 'Delhi, India',
    title: 'Senior Solution Architect',
    summary: 'Senior Solution Architect with 18 years of experience in designing and delivering scalable, enterprise-grade solutions. Expert in .NET Core, Angular, React, Node.js, and cloud platforms, with a proven record of leading teams, driving innovation, and building high-quality applications.',
    experienceYears: 18,
    linkedIn: 'https://www.linkedin.com/in/mohammad-khalid-software-architect/',
    github: 'https://github.com/mohammad-khalid',
    avatar: '/uploads/avatar.jpg',
  });

  // Skills
  await Skill.insertMany([
    { category: 'Programming & Frameworks', items: [
      { name: 'C#', level: 95 }, { name: '.NET Core', level: 95 },
      { name: 'JavaScript', level: 90 }, { name: 'TypeScript', level: 90 },
      { name: 'Angular', level: 90 }, { name: 'React.js', level: 85 },
      { name: 'Node.js', level: 85 },
    ], order: 1 },
    { category: 'Database & API', items: [
      { name: 'SQL Server', level: 90 }, { name: 'REST API Design', level: 95 },
      { name: 'MongoDB', level: 80 }, { name: 'GraphQL', level: 70 },
    ], order: 2 },
    { category: 'Cloud & DevOps', items: [
      { name: 'Azure', level: 85 }, { name: 'AWS', level: 80 },
      { name: 'Docker', level: 80 }, { name: 'CI/CD', level: 85 },
    ], order: 3 },
    { category: 'AI & Generative AI', items: [
      { name: 'OpenAI API', level: 80 }, { name: 'Gemini API', level: 75 },
    ], order: 4 },
  ]);

  // Experience
  await Experience.insertMany([
    {
      company: 'LanceSoft Inc.',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India (Remote)',
      startDate: 'Jun 2022',
      endDate: 'Jul 2025',
      bullets: [
        'Architected and developed an enterprise logistics management system using .NET Core and Angular 20, improving operational efficiency by 30%',
        'Led a team of 8 developers, managing a $500,000 budget with microservices and SOA principles',
        'Optimized Oracle database performance by 25% through PL/SQL enhancements and query tuning',
        'Implemented real-time ECD features using SignalR, reducing equipment downtime by 15%',
        'Enhanced user satisfaction by 20% building modern responsive UI with Angular 20, TypeScript, and RxJS',
        'Architected MERN-based solutions with React, Node.js, and RESTful services',
      ],
      order: 1,
    },
    {
      company: 'Infinity Quest',
      role: 'Senior Consultant | Full Stack Developer',
      location: 'Delhi, India (Remote)',
      startDate: 'Jun 2021',
      endDate: 'May 2022',
      bullets: [
        'Designed role-based LMS using .NET Core 5 and Angular 11, boosting course completion rates by 40%',
        'Implemented RESTful APIs improving backend communication efficiency by 35%',
        'Engineered Role-Based Access Control (RBAC) for Administrators, Learners, and Managers',
        'Enabled compliance tracking with 99% accuracy',
        'Applied security best practices mitigating risks by 95%',
      ],
      order: 2,
    },
    {
      company: 'AgreeYa Solutions',
      role: 'Sr Software Engineer',
      location: 'Noida, India',
      startDate: 'Nov 2015',
      endDate: 'May 2021',
      bullets: [
        'Developed document management solutions with SharePoint Online, Power Apps, and Power Automate, cutting processing time by 50%',
        'Built Extended Warranty Claim System using .NET Core, Angular 8, handling 10,000+ claims annually',
        'Integrated enterprise platforms connecting SharePoint 2013 with Collibra via REST APIs',
      ],
      order: 3,
    },
  ]);

  // Education
  await Education.insertMany([
    {
      degree: 'M. Sc.',
      field: 'Computer Science',
      institution: 'Karnataka State Open University (KSOU)',
      location: 'Delhi, India',
      startDate: 'Jan 2013',
      endDate: 'Jan 2014',
      order: 1,
    },
    {
      degree: 'BCA',
      field: 'Computers',
      institution: 'IBME',
      location: 'Delhi, India',
      startDate: 'Jan 1999',
      endDate: 'Jan 2002',
      order: 2,
    },
  ]);

  // Certifications
  await Certification.create({
    name: 'Exam 339: Managing Microsoft SharePoint Server 2016',
    issuer: 'Microsoft',
    date: 'Jan 2019',
  });

  // Projects
  // Article
  await Article.create({
    title: 'Low-Level Design: A Practical Guide for Building Maintainable Systems',
    slug: 'low-level-design-practical-guide',
    excerpt: 'Low-Level Design (LLD) bridges the gap between system requirements and actual code. This guide covers class design, design patterns, SOLID principles, and practical examples for building maintainable, scalable software.',
    content: `# Low-Level Design: A Practical Guide for Building Maintainable Systems

Low-Level Design (LLD) is the phase of software development where high-level architectural decisions are translated into detailed component specifications, class hierarchies, interfaces, and data structures. While High-Level Design (HLD) answers *what* systems to build, LLD answers *how* to build them at the code level.

\`\`\`mermaid
flowchart LR
    A[Requirements] --> B[High-Level Design]
    B --> C[Low-Level Design]
    C --> D[Implementation]
    D --> E[Testing]
    E --> F[Deployment]
    
    B -.->|"What to build?"| B1((System Architecture))
    C -.->|"How to build?"| C1((Class Design))
    C -.-> C2((Patterns))
    C -.-> C3((Interfaces))
\`\`\`

## Why LLD Matters

A well-crafted LLD brings several benefits:

- **Maintainability** — Clear class boundaries and responsibilities make code easier to modify
- **Testability** — Loosely coupled components can be tested in isolation
- **Scalability** — Proper abstractions allow adding features without rewriting existing code
- **Team Productivity** — Multiple developers can work on well-defined components simultaneously

## Core Principles

### SOLID Principles

The SOLID principles are the foundation of good LLD:

\`\`\`mermaid
mindmap
  root((SOLID))
    SRP
      Single Responsibility
      One reason to change
    OCP
      Open for extension
      Closed for modification
    LSP
      Substitutable types
      No broken contracts
    ISP
      Focused interfaces
      No unused dependencies
    DIP
      Depend on abstractions
      Not on concretions
\`\`\`

**Single Responsibility Principle (SRP):** A class should have only one reason to change. For example, separate order processing, email notification, and payment logic into distinct classes rather than a monolithic \`OrderService\`.

**Open/Closed Principle (OCP):** Classes should be open for extension but closed for modification. Use inheritance or composition to add behavior rather than modifying existing code.

**Liskov Substitution Principle (LSP):** Derived classes must be substitutable for their base classes without altering program correctness.

**Interface Segregation Principle (ISP):** Clients should not be forced to depend on interfaces they do not use. Prefer smaller, focused interfaces over large, general-purpose ones.

**Dependency Inversion Principle (DIP):** High-level modules should not depend on low-level modules. Both should depend on abstractions.

### Design Patterns

Some essential patterns for everyday LLD:

| Pattern | Use Case | Example |
|---|---|---|
| **Factory Method** | Object creation delegated to subclasses | \`DatabaseFactory.Create("SqlServer")\` |
| **Strategy** | Interchangeable algorithms | Payment processing, fee calculation |
| **Observer** | One-to-many notifications | Event handling, pub/sub |
| **Repository** | Abstract data access | \`IOrderRepository\` |
| **Decorator** | Add behavior dynamically | Logging, caching middleware |

\`\`\`mermaid
flowchart TB
    subgraph Creational
        F[Factory Method]
        S[Singleton]
    end
    subgraph Structural
        A[Adapter]
        D[Decorator]
        P[Facade]
    end
    subgraph Behavioral
        ST[Strategy]
        O[Observer]
        C[Command]
    end
    
    F -->|"Hides creation logic"| P1((Product))
    ST -->|"Interchangeable"| P2((Algorithm))
    D -->|"Wraps objects"| P3((Enhanced Behavior))
\`\`\`

## Practical Example: Parking Lot System

Let's design a parking lot system as a common LLD exercise.

\`\`\`mermaid
classDiagram
    class Vehicle {
        +String LicensePlate
        +VehicleType Type
    }
    class ParkingSpot {
        +String Id
        +SpotType Type
        +int Floor
        -bool IsOccupied
        -Vehicle ParkedVehicle
        +CanPark(Vehicle) bool
        +Park(Vehicle) void
        +Unpark() Vehicle
    }
    class ParkingFloor {
        +int FloorNumber
        +List~ParkingSpot~ Spots
        +AvailableSpots(SpotType) int
    }
    class ParkingLot {
        -List~ParkingFloor~ Floors
        -ParkingFeeStrategy FeeStrategy
        +FindSpot(Vehicle) ParkingSpot
        +ParkVehicle(Vehicle) ParkingTicket
        +UnparkVehicle(ParkingTicket) double
    }
    class ParkingFeeStrategy {
        <<interface>>
        +CalculateFee(TimeSpan) double
    }
    class MallParkingFee {
        +CalculateFee(TimeSpan) double
    }
    class AirportParkingFee {
        +CalculateFee(TimeSpan) double
    }
    class ParkingTicket {
        +Vehicle Vehicle
        +ParkingSpot Spot
        +DateTime EntryTime
    }
    
    ParkingLot --> ParkingFloor : contains
    ParkingLot --> ParkingFeeStrategy : uses
    ParkingFloor --> ParkingSpot : contains
    ParkingSpot --> Vehicle : parks
    ParkingFeeStrategy <|-- MallParkingFee
    ParkingFeeStrategy <|-- AirportParkingFee
    ParkingTicket --> Vehicle
    ParkingTicket --> ParkingSpot
\`\`\`

### Requirements

1. The parking lot has multiple floors, each with multiple spots
2. Spots can be of different types: Compact, Large, Handicapped, Electric
3. Vehicles can be parked and unparked
4. Track availability per floor and spot type
5. Calculate parking fees

### Flow of Parking a Vehicle

\`\`\`mermaid
sequenceDiagram
    participant Driver
    participant EntryGate
    participant ParkingLot
    participant ParkingSpot
    
    Driver->>EntryGate: Arrives with Vehicle
    EntryGate->>ParkingLot: FindSpot(vehicle)
    ParkingLot->>ParkingSpot: Check availability
    ParkingSpot-->>ParkingLot: Available
    ParkingLot-->>EntryGate: Spot #42, Floor 1
    
    EntryGate->>Driver: Ticket issued
    Driver->>ParkingSpot: Parks vehicle
    ParkingSpot->>ParkingSpot: IsOccupied = true
    
    Note over Driver,ParkingSpot: Later...
    
    Driver->>EntryGate: Returns to exit
    EntryGate->>ParkingLot: UnparkVehicle(ticket)
    ParkingLot->>ParkingFeeStrategy: CalculateFee(duration)
    ParkingFeeStrategy-->>ParkingLot: $15.00
    ParkingLot->>ParkingSpot: Unpark()
    ParkingSpot-->>ParkingLot: Vehicle returned
    ParkingLot-->>EntryGate: Fee: $15.00
    Driver->>EntryGate: Pays fee
    EntryGate->>Driver: Gate opens
\`\`\`

### Class Design

\`\`\`csharp
public enum VehicleType { Motorcycle, Car, Bus, Electric }
public enum SpotType { Compact, Large, Handicapped, Electric }

public class Vehicle {
    public string LicensePlate { get; set; }
    public VehicleType Type { get; set; }
}

public class ParkingSpot {
    public string Id { get; set; }
    public SpotType Type { get; set; }
    public int Floor { get; set; }
    public bool IsOccupied { get; private set; }
    public Vehicle? ParkedVehicle { get; private set; }

    public bool CanPark(Vehicle vehicle) {
        if (IsOccupied) return false;
        return Type switch {
            SpotType.Compact => vehicle.Type == VehicleType.Motorcycle || vehicle.Type == VehicleType.Car,
            SpotType.Large => true,
            SpotType.Handicapped => vehicle.Type == VehicleType.Car,
            SpotType.Electric => vehicle.Type == VehicleType.Electric || vehicle.Type == VehicleType.Car,
            _ => false
        };
    }

    public void Park(Vehicle vehicle) {
        if (!CanPark(vehicle)) throw new InvalidOperationException("Cannot park here");
        ParkedVehicle = vehicle;
        IsOccupied = true;
    }

    public Vehicle Unpark() {
        var v = ParkedVehicle;
        ParkedVehicle = null;
        IsOccupied = false;
        return v!;
    }
}

public class ParkingFloor {
    public int FloorNumber { get; set; }
    public List<ParkingSpot> Spots { get; set; } = new();
    public int AvailableSpots(SpotType? type = null) =>
        Spots.Count(s => !s.IsOccupied && (type == null || s.Type == type));
}

public class ParkingLot {
    private List<ParkingFloor> _floors = new();
    private ParkingFeeStrategy _feeStrategy;

    public ParkingLot(ParkingFeeStrategy feeStrategy) {
        _feeStrategy = feeStrategy;
    }

    public ParkingSpot? FindSpot(Vehicle vehicle) {
        return _floors.SelectMany(f => f.Spots)
            .FirstOrDefault(s => s.CanPark(vehicle));
    }

    public ParkingTicket ParkVehicle(Vehicle vehicle) {
        var spot = FindSpot(vehicle) ?? throw new Exception("No spot available");
        spot.Park(vehicle);
        return new ParkingTicket(vehicle, spot, DateTime.UtcNow);
    }

    public double UnparkVehicle(ParkingTicket ticket) {
        ticket.Spot.Unpark();
        var duration = DateTime.UtcNow - ticket.EntryTime;
        return _feeStrategy.CalculateFee(duration);
    }
}
\`\`\`

### Fee Calculation (Strategy Pattern)

\`\`\`mermaid
flowchart TD
    subgraph "Strategy Pattern"
        direction TB
        C[Client] --> I[<<interface>> ParkingFeeStrategy]
        I -->|CalculateFee| M[MallParkingFee]
        I -->|CalculateFee| A[AirportParkingFee]
        I -->|CalculateFee| S[StreetParkingFee]
    end
    
    M -->|"$10/hr first hour"| R1((Hourly Rate))
    A -->|"$100/day"| R2((Daily Rate))
    S -->|"$2/hr flat"| R3((Flat Rate))
\`\`\`

\`\`\`csharp
public interface ParkingFeeStrategy {
    double CalculateFee(TimeSpan duration);
}

public class MallParkingFee : ParkingFeeStrategy {
    public double CalculateFee(TimeSpan duration) {
        var hours = Math.Ceiling(duration.TotalHours);
        if (hours <= 1) return 10;
        if (hours <= 4) return 20;
        return 40;
    }
}

public class AirportParkingFee : ParkingFeeStrategy {
    public double CalculateFee(TimeSpan duration) {
        var days = Math.Ceiling(duration.TotalDays);
        return days * 100;
    }
}
\`\`\`

## Common Mistakes to Avoid

\`\`\`mermaid
flowchart LR
    M1[Over-engineering] -->|"YAGNI principle"| S1[Simple is better]
    M2[God Classes] -->|"Split by SRP"| S2[Focused classes]
    M3[Tight Coupling] -->|"Depend on interfaces"| S3[Loosely coupled]
    M4[No Tests] -->|"Testable design"| S4[Confident refactoring]
    M5[Magic Numbers] -->|"Use constants"| S5[Configurable values]
    
    style M1 fill:#ef444420,stroke:#ef4444
    style M2 fill:#ef444420,stroke:#ef4444
    style M3 fill:#ef444420,stroke:#ef4444
    style M4 fill:#ef444420,stroke:#ef4444
    style M5 fill:#ef444420,stroke:#ef4444
    style S1 fill:#10b98120,stroke:#10b981
    style S2 fill:#10b98120,stroke:#10b981
    style S3 fill:#10b98120,stroke:#10b981
    style S4 fill:#10b98120,stroke:#10b981
    style S5 fill:#10b98120,stroke:#10b981
\`\`\`

1. **Over-engineering** — Don't add abstractions you don't need yet. YAGNI (You Ain't Gonna Need It)
2. **Ignoring edge cases** — Always consider nulls, empty collections, boundary conditions
3. **God classes** — A class with too many responsibilities violates SRP
4. **Missing tests** — LLD creates testable units; writing tests validates your design
5. **Tight coupling** — Prefer composition over inheritance; depend on interfaces

## Conclusion

Low-Level Design is where architecture meets code. By applying SOLID principles, choosing the right design patterns, and thinking carefully about class responsibilities, you create systems that are maintainable, testable, and adaptable to change.

\`\`\`mermaid
flowchart TB
    subgraph "LLD Process"
        direction TB
        R[Requirements] --> C2[Class Identification]
        C2 --> R2[Relationships]
        R2 --> I[Interface Design]
        I --> P[Pattern Selection]
        P --> D2[Detailed Design]
        D2 --> CR[Code Review]
    end
    
    subgraph "Outcome"
        direction TB
        M[Maintainable]
        T[Testable]
        S[Scalable]
    end
    
    CR --> M
    CR --> T
    CR --> S
\`\`\`

Practice with common LLD problems — parking lot, elevator system, vending machine, chess game — and you'll develop an intuition for good design.
`,
    tags: ['Low-Level Design', 'SOLID', 'Design Patterns', 'Architecture', 'C#'],
    published: true,
  });

  await Project.insertMany([
    {
      name: 'Smart Inventory & Order Management System (SIOMS)',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India',
      startDate: 'Jul 2025',
      endDate: 'Jan 2026',
      description: 'Smart Inventory & Order Management System using .NET 9, Angular 20, TypeScript and SQL Server 2022',
      techStack: ['.NET 9', 'Angular 20', 'TypeScript', 'SQL Server 2022', 'Clean Architecture', 'CQRS', 'JWT'],
      bullets: [
        'Implemented Clean Architecture Microservices with CQRS, Repository, and Unit of Work patterns',
        'Built secure RESTful APIs with JWT authentication, Fluent Validation, and AutoMapper',
        'Designed responsive Angular Material dashboard with real-time alerts and ngx-charts',
        'Integrated Serilog for centralized logging and background services for low-stock alerts',
      ],
      order: 1,
    },
    {
      name: 'AI-Powered E-Commerce Platform',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India',
      startDate: 'Jul 2025',
      endDate: 'Jan 2026',
      description: 'Full-stack e-commerce platform using MERN stack deployed on AWS infrastructure',
      techStack: ['MongoDB', 'Express.js', 'React 18', 'Node.js', 'AWS EC2/S3', 'Docker', 'Redis', 'OpenAI', 'Stripe'],
      bullets: [
        'Built hybrid RESTful and GraphQL APIs, containerized using Docker and deployed via ECS',
        'Integrated Redis caching reducing average API latency by 40%',
        'Implemented AI-powered recommendation engine using OpenAI API',
        'Integrated Stripe for secure payments and role-based admin panel',
        'Configured CI/CD pipeline and monitored using CloudWatch',
      ],
      order: 2,
    },
  ]);

  // Admin
  const hashed = await bcrypt.hash('admin123', 10);
  await Admin.create({ username: 'admin', password: hashed });

  console.log('Seed complete!');
  console.log('Admin login: admin / admin123');
  process.exit();
};

seed();
