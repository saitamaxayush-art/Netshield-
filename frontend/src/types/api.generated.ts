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
        /** Simulate Failures */
        post: operations["simulate_failures_api_simulate_post"];
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
        /** EdgeModel */
        EdgeModel: {
            /** Id */
            id: string;
            /** Source */
            source: string;
            /** Target */
            target: string;
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
        /** Meta */
        Meta: {
            /** Apiversion */
            apiVersion: string;
            /**
             * Engine
             * @default networkx
             * @constant
             */
            engine: "networkx";
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
        /** NodeModel */
        NodeModel: {
            /** Id */
            id: string;
            /** Label */
            label: string;
            /**
             * Type
             * @default router
             */
            type?: string | null;
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
        /** ReliabilitySweepPoint */
        ReliabilitySweepPoint: {
            /** Connected Trials */
            connected_trials: number;
            /** Prob */
            prob: number;
            /** Reliability */
            reliability: number;
            /** Standard Error */
            standard_error: number;
            /** Total Trials */
            total_trials: number;
        };
        /** ReliabilitySweepRequest */
        ReliabilitySweepRequest: {
            /** Edges */
            edges: components["schemas"]["EdgeModel"][];
            /**
             * Fail Target
             * @default edges
             * @enum {string}
             */
            fail_target?: "nodes" | "edges" | "both";
            /** Failed Edges */
            failed_edges?: string[];
            /** Failed Nodes */
            failed_nodes?: string[];
            /** Nodes */
            nodes: components["schemas"]["NodeModel"][];
            /** Probs */
            probs: number[];
            /**
             * Trials Per Prob
             * @default 100
             */
            trials_per_prob?: number;
        };
        /** ReliabilitySweepResponse */
        ReliabilitySweepResponse: {
            /**
             * Fail Target
             * @enum {string}
             */
            fail_target: "nodes" | "edges" | "both";
            /**
             * Is Demo
             * @default false
             */
            is_demo?: boolean;
            /** Points */
            points: components["schemas"]["ReliabilitySweepPoint"][];
            /** Trials Per Prob */
            trials_per_prob: number;
        };
        /** SimulateRequest */
        SimulateRequest: {
            /** Edges */
            edges: components["schemas"]["EdgeModel"][];
            /**
             * Fail Target
             * @default edges
             * @enum {string}
             */
            fail_target?: "nodes" | "edges" | "both";
            /** Failed Edges */
            failed_edges?: string[];
            /** Failed Nodes */
            failed_nodes?: string[];
            /**
             * Failure Prob
             * @default 0.1
             */
            failure_prob?: number;
            /** Nodes */
            nodes: components["schemas"]["NodeModel"][];
            /**
             * Trials
             * @default 500
             */
            trials?: number;
        };
        /** SimulateResponse */
        SimulateResponse: {
            /** Active Components Distribution */
            active_components_distribution?: {
                [key: string]: number;
            } | null;
            /** Confidence Interval 95 */
            confidence_interval_95: [
                number,
                number
            ];
            /** Connected Trials */
            connected_trials: number;
            /** Estimated Reliability */
            estimated_reliability: number;
            /** Execution Time Ms */
            execution_time_ms: number;
            /**
             * Fail Target
             * @enum {string}
             */
            fail_target: "nodes" | "edges" | "both";
            /** Failure Probability */
            failure_probability: number;
            /**
             * Is Demo
             * @default false
             */
            is_demo?: boolean;
            /** Standard Error */
            standard_error: number;
            /** Trials */
            trials: number;
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
                "application/json": components["schemas"]["ReliabilitySweepRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReliabilitySweepResponse"];
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
    simulate_failures_api_simulate_post: {
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
        };
    };
}
