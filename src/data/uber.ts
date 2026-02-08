import type { SystemDesign } from './types';

export const uber: SystemDesign = {
  slug: 'uber',
  name: 'Uber',
  tagline: 'Real-time ride matching with geospatial intelligence',
  category: 'transport',
  tags: ['transport', 'geospatial', 'real-time', 'matching', 'maps'],
  overview: `Uber's ride-hailing platform connects millions of riders with drivers across 10,000+ cities worldwide. Its architecture must solve complex real-time problems: matching riders to nearby drivers, computing ETAs, tracking live locations, calculating dynamic pricing, and processing payments — all within seconds. The system processes millions of location updates per second and completes trip matching in under 10 seconds.`,
  scale: {
    'Monthly active riders': '130M+',
    'Trips per day': '~28M',
    'GPS updates/second': 'Millions',
    'Trip & location data': 'Petabytes',
  },
  requirements: {
    functional: [
      'Rider-driver matching based on proximity and ETA',
      'Real-time GPS tracking of rides',
      'Dynamic pricing (surge pricing)',
      'ETA estimation and route optimization',
      'Payment processing and fare calculation',
      'Trip history and receipts',
      'Driver and rider ratings',
    ],
    nonFunctional: [
      'Sub-10 second ride matching',
      'Real-time location processing at massive scale',
      'High availability across cities worldwide',
      'Accurate ETA predictions',
      'Fraud detection in real-time',
      'Support for millions of concurrent GPS streams',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        RA[Rider App]
        DA[Driver App]
    end
    subgraph Edge
        AG[API Gateway]
        LB[Load Balancer]
    end
    subgraph Core["Core Platform"]
        MATCH[Matching Service]
        TRIP[Trip Service]
        LOC[Location Service]
        PRICE[Pricing Service]
        ETA[ETA Service]
        PAY[Payment Service]
        MAP[Maps Service]
    end
    subgraph Data["Data Infrastructure"]
        GEO[(Geospatial Index)]
        KF[(Kafka)]
        CS[(Cassandra)]
        RD[(Redis)]
    end
    RA & DA --> LB --> AG
    AG --> MATCH & TRIP & LOC & PRICE
    DA -->|GPS stream| LOC
    LOC --> GEO
    MATCH --> LOC & ETA & PRICE
    TRIP --> CS & PAY
    ETA --> MAP
    LOC --> KF`,
  components: [
    { name: 'Location Service', description: 'Ingests millions of GPS updates per second from driver apps. Uses a geospatial index (Google S2 cells) to efficiently query nearby drivers. Data is partitioned using consistent hashing (Ringpop).' },
    { name: 'Matching Service (DISCO)', description: 'Uber\'s dispatch optimization system. Matches riders with the best available driver based on proximity, ETA, driver preferences, and supply-demand balance.' },
    { name: 'Pricing Service', description: 'Calculates fares and implements dynamic (surge) pricing based on real-time supply-demand ratios per geographic zone. Uses ML for demand forecasting.' },
    { name: 'ETA Service', description: 'Predicts arrival times using real-time traffic data, historical patterns, and ML models. Considers road segments, traffic signals, and time-of-day patterns.' },
    { name: 'Trip Service', description: 'Manages the full trip lifecycle from request to completion, including state machine transitions, fare calculation, and receipt generation.' },
    { name: 'Maps/Routing Service', description: 'Custom routing engine built on OpenStreetMap data, enhanced with road network data from billions of historical trips.' },
  ],
  dataModel: `erDiagram
    RIDER {
        bigint rider_id PK
        string name
        string email
        float rating
    }
    DRIVER {
        bigint driver_id PK
        string name
        string vehicle_info
        float rating
        enum status
        float current_lat
        float current_lng
    }
    TRIP {
        bigint trip_id PK
        bigint rider_id FK
        bigint driver_id FK
        float pickup_lat
        float pickup_lng
        float dropoff_lat
        float dropoff_lng
        enum status
        float fare_amount
        float surge_multiplier
    }
    LOCATION_UPDATE {
        bigint driver_id FK
        float latitude
        float longitude
        float speed
        timestamp ts
    }
    RIDER ||--o{ TRIP : requests
    DRIVER ||--o{ TRIP : fulfills
    DRIVER ||--o{ LOCATION_UPDATE : emits`,
  deepDive: [
    {
      title: 'Geospatial Indexing with S2 Geometry',
      content: `Uber uses **Google S2 Geometry** to solve the core problem of finding nearby drivers efficiently.\n\n**How S2 Works:**\n- Divides Earth's surface into hierarchical cells using a Hilbert curve\n- Each cell has a unique 64-bit ID\n- Cells at level 12 (~3.3km²) are used as the primary partitioning unit\n\n**Finding Nearby Drivers:**\n1. Convert rider's location to an S2 cell ID\n2. Query the geospatial index for all drivers in that cell and neighbors\n3. Filter by distance, then compute road-network ETA for top candidates\n4. The matching algorithm selects the optimal driver\n\n**Why S2 over alternatives (Geohash, H3)?**\n- No edge-case distortion at poles or date line\n- Hierarchical cells enable efficient range queries\n- Cell IDs map naturally to distributed storage keys\n- Better approximation of circular search areas\n\nThe geospatial index is sharded using **Ringpop** (consistent hashing) so each server owns a set of S2 cells, enabling horizontal scaling.`,
      diagram: `graph TB
    subgraph Input
        GPS[Driver GPS Update]
        REQ[Rider Request]
    end
    subgraph S2["S2 Geospatial Index"]
        CELL1[Cell A - 4 drivers]
        CELL2[Cell B - 2 drivers]
        CELL3[Cell C - 7 drivers]
    end
    subgraph Process["Matching Pipeline"]
        NEARBY[Nearby Query]
        FILTER[Distance Filter]
        ETA[ETA Computation]
        RANK[Ranking]
        DISPATCH[Dispatch]
    end
    GPS --> CELL1 & CELL2 & CELL3
    REQ --> NEARBY
    NEARBY --> CELL1 & CELL2
    CELL1 & CELL2 --> FILTER
    FILTER --> ETA --> RANK --> DISPATCH`,
    },
    {
      title: 'Dynamic Pricing (Surge)',
      content: `Uber's surge pricing balances supply and demand in real-time:\n\n**How Surge Works:**\n1. The city is divided into **geospatial zones** (hexagonal cells)\n2. For each zone, compute the **supply-demand ratio** every few seconds\n3. When demand > supply, apply a **surge multiplier** (e.g., 1.5x, 2.0x)\n4. Higher prices incentivize more drivers to enter the zone\n5. As supply increases, surge naturally decreases\n\n**ML-Based Demand Forecasting:**\n- Uses historical data, weather, events, and time patterns\n- Predicts demand spikes before they happen (concert ending, sports game)\n- Pre-positions drivers in anticipated high-demand areas\n\n**Pricing Components:**\n- Base fare + per-minute rate + per-mile rate\n- Surge multiplier applied to the total\n- Minimum fare and booking fee\n- Tolls, airport fees, and surcharges\n\nThe pricing service must be **extremely fast** (<50ms) since it's called for every ride request.`,
    },
    {
      title: 'Real-Time Trip Tracking',
      content: `Once a trip is in progress, Uber tracks it in real-time:\n\n**Location Pipeline:**\n1. Driver app sends GPS updates every **4 seconds**\n2. Updates flow through Kafka to the Location Service\n3. Location Service updates the geospatial index and publishes to subscribers\n4. Rider app receives real-time driver position via WebSocket\n\n**State Machine:**\nEach trip follows a strict state machine:\n- REQUESTED → ACCEPTED → ARRIVING → IN_PROGRESS → COMPLETED\n- At each transition, specific actions are triggered (notifications, fare updates)\n\n**Route Snapping:**\nRaw GPS coordinates are "snapped" to the road network to:\n- Accurately calculate distance traveled (for fare computation)\n- Show smooth movement on the map\n- Handle GPS jitter in urban canyons and tunnels\n\nUber processes **millions of GPS events per second** through this pipeline.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'S2 Geometry for geospatial indexing',
      pros: ['No distortion at edges unlike geohash', 'Hierarchical multi-resolution queries', 'Efficient consistent hashing integration'],
      cons: ['More complex than simple geohash', 'Requires custom tooling', 'Steep learning curve'],
    },
    {
      decision: 'Dynamic surge pricing',
      pros: ['Balances supply and demand efficiently', 'Incentivizes driver availability', 'Optimizes platform economics'],
      cons: ['User perception issues during emergencies', 'Complex ML models required', 'Regulatory scrutiny'],
    },
    {
      decision: 'Event-driven architecture with Kafka',
      pros: ['Decouples services effectively', 'Natural audit trail of all events', 'Supports real-time and batch processing'],
      cons: ['Eventually consistent by nature', 'Kafka operational complexity', 'Message ordering challenges at scale'],
    },
  ],
};
