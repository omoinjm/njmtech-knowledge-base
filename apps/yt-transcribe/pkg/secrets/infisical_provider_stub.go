//go:build !infisical

package secrets

import (
	"context"
	"fmt"
)

// fetchFromInfisical is a stub implementation used when the `infisical` build tag
// is NOT provided. It provides a helpful error message explaining how to enable
// the real Infisical provider.
func fetchFromInfisical(ctx context.Context, secretKey, projectID, environment, secretPath string) (string, error) {
	return "", fmt.Errorf("Infisical provider not enabled: build with '-tags=infisical' and provide INFISICAL_* environment variables or implement fetchFromInfisical")
}
