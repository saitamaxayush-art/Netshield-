// GENERATED FILE. Do not edit. Source: FastAPI OpenAPI schema (backend/main.py).
// Regenerate with `npm run gen:api` in frontend/.

export type paths = {
    "/api/analyze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze */
        post: operations["analyze_api_analyze_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Api Health */
        get: operations["api_health_api_health_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reliability-sweep": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reliability Sweep */
        post: operations["reliability_sweep_api_reliability_sweep_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Simulate */
        post: operations["simulate_api_simulate_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        /** Analysis */
        Analysis: {
            articulationPoints: components["schemas"]["ArticulationPoints"];
            bridges: components["schemas"]["Bridges"];
            components: components["schemas"]["Components"];
            connectivity: components["schemas"]["Connectivity"];
            degrees: components["schemas"]["Degrees"];
            path: components["schemas"]["PathResult"] | null;
            summary: components["schemas"]["Summary"];
            traversal: components["schemas"]["Traversal"] | null;
        };
        /** AnalyzeRequest */
        AnalyzeRequest: {
            /**
             * Comparehealthy
             * @default false
             */
            compareHealthy?: boolean;
            /** Edges */
            edges: components["schemas"]["Edge"][];
            /** Nodes */
            nodes: components["schemas"]["Node"][];
            /** Pathsource */
            pathSource?: string | null;
            /** Pathtarget */
            pathTarget?: string | null;
            /** Startnodeid */
            startNodeId?: string | null;
            /**
             * Useweights
             * @default false
             */
            useWeights?: boolean;
        };
        /** AnalyzeResponse */
        AnalyzeResponse: {
            current: components["schemas"]["Analysis"];
            healthy: components["schemas"]["Analysis"] | null;
            meta: components["schemas"]["Meta"];
        };
        /** ArticulationPoints */
        ArticulationPoints: {
            /**
             * Explanationkey
             * @default articulation_point_definition
             * @constant
             */
            explanationKey: "articulation_point_definition";
            /** Nodeids */
            nodeIds: string[];
        };
        /** BfsStep */
        BfsStep: {
            /** Layer */
            layer: number;
            /** Nodeid */
            nodeId: string;
        };
        /** Bridges */
        Bridges: {
            /** Edgeids */
            edgeIds: string[];
            /**
             * Explanationkey
             * @default bridge_definition
             * @constant
             */
            explanationKey: "bridge_definition";
        };
        /** Components */
        Components: {
            /** Componentof */
            componentOf: {
                [key: string]: number | null;
            };
            /**
             * Explanationkey
             * @default component_definition
             * @constant
             */
            explanationKey: "component_definition";
            /** Items */
            items: string[][];
        };
        /** Connectivity */
        Connectivity: {
            /** Componentcount */
            componentCount: number;
            /** Connected */
            connected: boolean;
            /**
             * Explanationkey
             * @default connectivity_definition
             * @constant
             */
            explanationKey: "connectivity_definition";
            /** Reason */
            reason: string;
            /**
             * Reasonkey
             * @enum {string}
             */
            reasonKey: "empty_network" | "single_component" | "multiple_components";
        };
        /** CriticalEdge */
        CriticalEdge: {
            /** Edgeid */
            edgeId: string;
            /**
             * Explanationkey
             * @default critical_edge_definition
             * @constant
             */
            explanationKey: "critical_edge_definition";
            /** Pivotaltrials */
            pivotalTrials: number;
            /** Share */
            share: number;
        };
        /** DegreeEntry */
        DegreeEntry: {
            /** Operational */
            operational: number;
            /** Stored */
            stored: number;
        };
        /** Degrees */
        Degrees: {
            /** Bynode */
            byNode: {
                [key: string]: components["schemas"]["DegreeEntry"];
            };
            /**
             * Explanationkey
             * @default degree_definition
             * @constant
             */
            explanationKey: "degree_definition";
        };
        /** Edge */
        Edge: {
            /**
             * Failed
             * @default false
             */
            failed?: boolean;
            /** Failureprobability */
            failureProbability?: number | null;
            /** Id */
            id: string;
            /** Source */
            source: string;
            /** Target */
            target: string;
            /** Weight */
            weight?: number | null;
        };
        /** ErrorInfo */
        ErrorInfo: {
            /** Code */
            code: string;
            /** Details */
            details?: {
                [key: string]: string | number | string[];
            } | {
                [key: string]: string;
            }[] | null;
            /** Message */
            message: string;
        };
        /**
         * ErrorResponse
         * @description Body of every non 2xx response: {"error": {"code", "message", "details"?}}.
         */
        ErrorResponse: {
            error: components["schemas"]["ErrorInfo"];
        };
        /** HealthResponse */
        HealthResponse: {
            /** Engine */
            engine: string;
            /** Service */
            service: string;
            /**
             * Status
             * @constant
             */
            status: "ok";
            /** Version */
            version: string;
        };
        /** HistogramBin */
        HistogramBin: {
            /** Components */
            components: number;
            /** Trials */
            trials: number;
        };
        /** Meta */
        Meta: {
            /** Apiversion */
            apiVersion: string;
            /**
             * Engine
             * @default networkx
             * @enum {string}
             */
            engine: "networkx" | "demo";
            /** Engineversion */
            engineVersion: string;
        };
        /** Node */
        Node: {
            /**
             * Failed
             * @default false
             */
            failed?: boolean;
            /** Id */
            id: string;
            /** Label */
            label: string;
            /**
             * Type
             * @enum {string}
             */
            type: "router" | "server" | "client" | "firewall";
        };
        /** PathResult */
        PathResult: {
            /** Edgeids */
            edgeIds: string[] | null;
            /**
             * Explanationkey
             * @enum {string}
             */
            explanationKey: "shortest_path_hops" | "shortest_path_weighted";
            /** Found */
            found: boolean;
            /** Hops */
            hops: number | null;
            /** Length */
            length: number | null;
            /**
             * Metric
             * @enum {string}
             */
            metric: "hops" | "weight";
            /** Nodeids */
            nodeIds: string[] | null;
            /** Reason */
            reason: ("SOURCE_FAILED" | "TARGET_FAILED" | "DISCONNECTED") | null;
            /** Reasonkey */
            reasonKey: ("path_source_failed" | "path_target_failed" | "path_disconnected") | null;
            /** Source */
            source: string;
            /** Target */
            target: string;
            /** Weightsignoredreason */
            weightsIgnoredReason: "MISSING_WEIGHTS" | null;
        };
        /** SimulateRequest */
        SimulateRequest: {
            /** Edgefailureprobability */
            edgeFailureProbability: number;
            /** Edges */
            edges: components["schemas"]["Edge"][];
            /**
             * Mode
             * @default all-terminal
             * @enum {string}
             */
            mode?: "all-terminal" | "two-terminal";
            /**
             * Nodefailureprobability
             * @default 0
             */
            nodeFailureProbability?: number;
            /** Nodes */
            nodes: components["schemas"]["Node"][];
            /** Seed */
            seed?: number | null;
            /** Source */
            source?: string | null;
            /** Target */
            target?: string | null;
            /**
             * Trials
             * @default 1000
             */
            trials?: number;
        };
        /** SimulateResponse */
        SimulateResponse: {
            /** Assumptions */
            assumptions: string[];
            /** Averagecomponents */
            averageComponents: number;
            /** Componenthistogram */
            componentHistogram: components["schemas"]["HistogramBin"][];
            /** Connectedtrials */
            connectedTrials: number;
            criticalEdge: components["schemas"]["CriticalEdge"] | null;
            /** Edgefailureprobability */
            edgeFailureProbability: number;
            /** Elapsedms */
            elapsedMs: number;
            /** Estimate */
            estimate: number;
            /**
             * Explanationkey
             * @default monte_carlo_estimate
             * @constant
             */
            explanationKey: "monte_carlo_estimate";
            meta: components["schemas"]["Meta"];
            /**
             * Mode
             * @enum {string}
             */
            mode: "all-terminal" | "two-terminal";
            /** Nodefailureprobability */
            nodeFailureProbability: number;
            /** Seed */
            seed: number;
            /** Source */
            source: string | null;
            /** Standarderror */
            standardError: number;
            /** Target */
            target: string | null;
            /** Trials */
            trials: number;
            wilson95: components["schemas"]["Wilson95"];
        };
        /** Summary */
        Summary: {
            /** Density */
            density: number;
            /** Edgecount */
            edgeCount: number;
            /**
             * Explanationkey
             * @default density_definition
             * @constant
             */
            explanationKey: "density_definition";
            /** Failededgecount */
            failedEdgeCount: number;
            /** Failednodecount */
            failedNodeCount: number;
            /** Nodecount */
            nodeCount: number;
            /** Operationaledgecount */
            operationalEdgeCount: number;
            /** Operationalnodecount */
            operationalNodeCount: number;
            /** Unavailableedgecount */
            unavailableEdgeCount: number;
        };
        /** SweepPoint */
        SweepPoint: {
            /** Connectedtrials */
            connectedTrials: number;
            /** Estimate */
            estimate: number;
            /** P */
            p: number;
            /** Standarderror */
            standardError: number;
            wilson95: components["schemas"]["Wilson95"];
        };
        /** SweepRequest */
        SweepRequest: {
            /** Edges */
            edges: components["schemas"]["Edge"][];
            /**
             * Mode
             * @default all-terminal
             * @enum {string}
             */
            mode?: "all-terminal" | "two-terminal";
            /**
             * Nodefailureprobability
             * @default 0
             */
            nodeFailureProbability?: number;
            /** Nodes */
            nodes: components["schemas"]["Node"][];
            /** Pmax */
            pMax: number;
            /** Pmin */
            pMin: number;
            /**
             * Points
             * @default 11
             */
            points?: number;
            /** Seed */
            seed?: number | null;
            /** Source */
            source?: string | null;
            /** Target */
            target?: string | null;
            /**
             * Trialsperpoint
             * @default 1000
             */
            trialsPerPoint?: number;
        };
        /** SweepResponse */
        SweepResponse: {
            /** Assumptions */
            assumptions: string[];
            /** Elapsedms */
            elapsedMs: number;
            /**
             * Explanationkey
             * @default reliability_sweep
             * @constant
             */
            explanationKey: "reliability_sweep";
            meta: components["schemas"]["Meta"];
            /**
             * Mode
             * @enum {string}
             */
            mode: "all-terminal" | "two-terminal";
            /** Nodefailureprobability */
            nodeFailureProbability: number;
            /** Points */
            points: components["schemas"]["SweepPoint"][];
            /** Seed */
            seed: number;
            /** Source */
            source: string | null;
            /** Target */
            target: string | null;
            /** Trialsperpoint */
            trialsPerPoint: number;
        };
        /** Traversal */
        Traversal: {
            /** Bfs */
            bfs: components["schemas"]["BfsStep"][];
            /**
             * Bfsexplanationkey
             * @default bfs_definition
             * @constant
             */
            bfsExplanationKey: "bfs_definition";
            /** Dfs */
            dfs: string[];
            /**
             * Dfsexplanationkey
             * @default dfs_definition
             * @constant
             */
            dfsExplanationKey: "dfs_definition";
            error: components["schemas"]["TraversalError"] | null;
            /** Startnodeid */
            startNodeId: string;
        };
        /** TraversalError */
        TraversalError: {
            /**
             * Code
             * @constant
             */
            code: "START_NODE_FAILED";
            /** Message */
            message: string;
        };
        /** Wilson95 */
        Wilson95: {
            /** High */
            high: number;
            /** Low */
            low: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    analyze_api_analyze_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnalyzeRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AnalyzeResponse"];
                };
            };
            /** @description Validation error or limit exceeded (API_CONTRACT.md section 5). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected server error. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    api_health_api_health_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    reliability_sweep_api_reliability_sweep_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SweepRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SweepResponse"];
                };
            };
            /** @description Validation error or limit exceeded (API_CONTRACT.md section 5). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected server error. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The run exceeded the server side time budget (code TIMEOUT). */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    simulate_api_simulate_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SimulateRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SimulateResponse"];
                };
            };
            /** @description Validation error or limit exceeded (API_CONTRACT.md section 5). */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected server error. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The run exceeded the server side time budget (code TIMEOUT). */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
