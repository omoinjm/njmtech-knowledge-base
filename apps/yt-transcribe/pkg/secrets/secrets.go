package secrets

import (
	"context"
	"fmt"
	"os"
)

// GetSecret attempts to retrieve a secret using the following precedence:
// 1. Read an environment variable named envVarName (this supports local dev and envs injected by Infisical)
// 2. If INFISICAL_ENABLED=="true", delegate to the Infisical provider (build-tagged implementation)
//
// secretKey is the key used within Infisical. projectID and environment are required when INFISICAL_ENABLED is true.
func GetSecret(ctx context.Context, envVarName, secretKey, projectID, environment string) (string, error) {
	// Prefer explicit environment variable (local development / CI / platform injection)
	if val := os.Getenv(envVarName); val != "" {
		return val, nil
	}

	if os.Getenv("INFISICAL_ENABLED") != "true" {
		return "", fmt.Errorf("%s not set and INFISICAL_ENABLED!=true", envVarName)
	}

	if projectID == "" || environment == "" {
		return "", fmt.Errorf("%s not set and INFISICAL_PROJECT_ID or INFISICAL_ENVIRONMENT missing for Infisical lookup", envVarName)
	}

	// Delegate to platform-specific implementation. When building without the `infisical` build tag
	// the stub implementation will return a helpful error explaining how to enable the provider.
	return fetchFromInfisical(ctx, secretKey, projectID, environment, "/")
}
