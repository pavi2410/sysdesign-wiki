import type { SystemDesign } from './types';

export const googleMaps: SystemDesign = {
  slug: 'google-maps',
  name: 'Google Maps',
  tagline: 'Real-time navigation and geospatial search for billions of users',
  category: 'search',
  tags: ['maps', 'geospatial', 'navigation', 'real-time', 'routing', 'search'],
  overview: `Google Maps is the world's most used mapping and navigation service, serving 1B+ monthly active users with real-time directions, place search, street view, and traffic information. Its architecture combines massive precomputed graph data (road networks, transit schedules), real-time sensor data (traffic from billions of Android phones), geospatial indexing for point-of-interest search, and a tile-based rendering system for map display. The system processes billions of routing requests daily while maintaining a continuously updated model of the world's roads and places.`,
  scale: {
    'Monthly active users': '1B+',
    'Countries covered': '220+',
    'Road data': '1B+ km of roads',
    'Places in database': '250M+',
  },
  requirements: {
    functional: [
      'Map rendering with vector tiles at multiple zoom levels',
      'Turn-by-turn navigation for driving, walking, cycling, transit',
      'Place search and discovery',
      'Real-time traffic and ETA updates',
      'Street View imagery',
      'Offline maps for areas without connectivity',
      'Location sharing and timeline',
    ],
    nonFunctional: [
      'Route computation in <200ms for most queries',
      'Real-time traffic updates with <2 minute freshness',
      'Map tile delivery in <100ms from edge',
      'Global coverage including offline areas',
      'Accuracy — route ETAs within 5% of actual',
      'Battery-efficient continuous location tracking',
    ],
  },
  highLevelDiagram: `graph TB
    subgraph Clients
        ANDROID[Android App]
        IOS[iOS App]
        WEB[Web App]
        APIDEV[Maps API Clients]
    end
    subgraph Edge["Edge / CDN"]
        CDN[Tile CDN]
        LB[Load Balancer]
    end
    subgraph Services["Core Services"]
        TILE[Tile Renderer]
        ROUTE[Routing Engine]
        PLACE[Places Service]
        TRAFFIC[Traffic Service]
        GEO[Geocoding Service]
        SV[Street View Service]
    end
    subgraph Data["Data Layer"]
        GRAPH[(Road Graph DB)]
        SPATIAL[(Spatial Index - S2)]
        POI[(Places DB)]
        IMAGERY[(Imagery Store)]
        PROBE[(Traffic Probe Data)]
    end
    ANDROID & IOS & WEB & APIDEV --> CDN & LB
    CDN --> TILE
    LB --> ROUTE & PLACE & GEO & SV
    TILE --> SPATIAL
    ROUTE --> GRAPH & TRAFFIC
    PLACE --> POI & SPATIAL
    TRAFFIC --> PROBE
    GEO --> SPATIAL & POI
    SV --> IMAGERY`,
  components: [
    { name: 'Tile Renderer', description: 'Generates vector map tiles at 20+ zoom levels. Tiles are pre-rendered for popular areas and generated on-demand for less trafficked regions. Uses Google\'s S2 geometry library for spatial partitioning. Tiles are served from edge CDN with aggressive caching.' },
    { name: 'Routing Engine', description: 'Computes optimal routes using a modified Contraction Hierarchies algorithm on a preprocessed road graph. Considers real-time traffic, road restrictions, tolls, and user preferences. Supports driving, walking, cycling, and transit with different graph weights.' },
    { name: 'Traffic Service', description: 'Aggregates anonymized location data from billions of Android phones and Waze users to compute real-time traffic speeds on every road segment. Updates traffic estimates every 1-2 minutes. Feeds into routing for dynamic ETA calculation.' },
    { name: 'Places Service', description: 'Manages the database of 250M+ places (businesses, landmarks, addresses). Handles place search, autocomplete, details, and reviews. Uses a combination of geospatial indexing (S2 cells) and text search for queries like "coffee near me".' },
    { name: 'Geocoding Service', description: 'Converts between human-readable addresses and geographic coordinates (lat/lng). Uses a combination of address parsing, interpolation along road segments, and building footprint matching.' },
    { name: 'Street View Service', description: 'Serves panoramic street-level imagery captured by camera cars, trekkers, and user contributions. Imagery is stored as tiled panoramas with depth maps, enabling smooth navigation between capture points.' },
  ],
  dataModel: `erDiagram
    ROAD_SEGMENT {
        bigint segment_id PK
        geometry polyline
        string name
        enum road_class
        int speed_limit
        boolean is_toll
        boolean is_oneway
    }
    PLACE {
        string place_id PK
        string name
        geometry location
        string address
        enum category
        float rating
        int review_count
        json opening_hours
    }
    TRAFFIC_READING {
        bigint segment_id FK
        timestamp captured_at
        int speed_kmh
        enum congestion_level
    }
    ROUTE_REQUEST {
        string request_id PK
        geometry origin
        geometry destination
        enum travel_mode
        json waypoints
        timestamp requested_at
    }
    ROAD_SEGMENT ||--o{ TRAFFIC_READING : has
    ROUTE_REQUEST }o--o{ ROAD_SEGMENT : uses`,
  deepDive: [
    {
      title: 'Routing with Contraction Hierarchies',
      content: `Google Maps computes billions of routes daily. Running Dijkstra's algorithm on a raw road graph with billions of edges would be far too slow. Instead, it uses **Contraction Hierarchies (CH)**.\n\n**Preprocessing**: The road graph is contracted offline by iteratively removing less important nodes and adding shortcut edges. A node on a residential street is contracted early, adding a shortcut between its neighbors. Major highway intersections are contracted last. This creates a hierarchical structure.\n\n**Query**: At query time, a bidirectional search runs from origin and destination simultaneously, only exploring edges that go "up" the hierarchy. This drastically reduces the search space — a continental route that would explore millions of nodes with Dijkstra's touches only thousands with CH.\n\n**Real-time traffic**: The edge weights in the CH are updated continuously based on traffic data. When traffic changes, only the affected shortcuts need recomputation. Google uses a variant called **Customizable Contraction Hierarchies** that separates the topology (which shortcuts exist) from the metrics (edge weights), allowing weight updates without full reprocessing.\n\n**Multi-modal**: For transit routing, a separate algorithm (RAPTOR or CSA) handles schedule-based queries, combined with walking segments from the road graph.`,
      diagram: `graph TB
    subgraph Original["Original Road Graph"]
        A[A] --- B[B] --- C[C]
        A --- D[D] --- C
        B --- E[E]
    end
    subgraph Contracted["Contracted Hierarchy"]
        A2[A] ---|shortcut| C2[C]
        A2 --- D2[D] --- C2
        A2 ---|highway| E2[E]
    end
    Original --> |"Contraction\nPreprocessing"| Contracted`,
    },
    {
      title: 'S2 Geometry and Spatial Indexing',
      content: `Google Maps uses the **S2 Geometry Library** for all geospatial indexing and partitioning.\n\n**S2 cells**: S2 projects the Earth's surface onto the faces of a cube, then subdivides each face into a quadtree of cells. Each cell has a unique 64-bit ID. Cells at level 30 are ~1 cm², while level 12 cells are ~3.3 km² — covering the range from global to street-level precision.\n\n**Spatial indexing**: Every place, road segment, and map feature is assigned to one or more S2 cells. Searching for "restaurants near me" becomes a cell-range query — find all S2 cells within a radius, then look up all places in those cells.\n\n**Map tiling**: Map tiles are aligned to S2 cell boundaries. This means tile rendering, spatial queries, and data partitioning all use the same coordinate system, simplifying the architecture.\n\n**Coverage unions**: S2 can represent arbitrary regions as a union of cells at different levels. This is used for features like "notify me when this area has less traffic" or defining offline map download regions.`,
    },
    {
      title: 'Real-time Traffic from Crowdsourced Data',
      content: `Google Maps' traffic data comes primarily from **anonymized location signals** from Android phones and Waze users.\n\n**Data collection**: When a user has location services enabled, their phone periodically reports anonymized speed and location data. This creates billions of "probe" data points per day across the world's road network.\n\n**Aggregation**: Probe data is aggregated per road segment in near real-time (<2 minutes). The system computes the median speed on each segment, compares it to the free-flow speed, and classifies congestion (green/yellow/red).\n\n**Privacy**: Individual probe data is never stored with user identity. Data is aggregated with differential privacy guarantees — a road segment must have a minimum number of probes before traffic is reported, and k-anonymity ensures no individual's route is reconstructable.\n\n**Prediction**: Beyond current traffic, Google Maps predicts future traffic using historical patterns (e.g., rush hour on this highway every weekday) combined with real-time trends. The ETA displayed for a route accounts for predicted traffic conditions along the entire path, not just current conditions.\n\n**Incident detection**: Sudden speed drops on a segment trigger automatic incident detection. Combined with Waze user reports, this feeds into route recalculation for affected users.`,
    },
  ],
  tradeoffs: [
    {
      decision: 'Precomputed Contraction Hierarchies over online Dijkstra',
      pros: ['Millisecond query times for continental routes', 'Predictable latency regardless of distance', 'Allows billions of daily queries'],
      cons: ['Hours of preprocessing when graph changes', 'Large memory footprint for shortcut edges', 'Complex to update with real-time traffic'],
    },
    {
      decision: 'Vector tiles over raster tiles',
      pros: ['Smaller tile sizes — faster loading', 'Client-side styling and rotation', 'Smooth zoom transitions'],
      cons: ['Higher client-side rendering cost', 'More complex client implementation', 'Requires GPU-capable client devices'],
    },
    {
      decision: 'Crowdsourced traffic over sensor-based',
      pros: ['Global coverage without physical infrastructure', 'Real-time updates from billions of devices', 'Automatically covers new roads'],
      cons: ['Dependent on smartphone penetration', 'Privacy concerns with location tracking', 'Less accurate on low-traffic roads'],
    },
  ],
};
