//go:build infisical

package secrets

import (
	"context"
	"fmt"
	"os"
	"reflect"

	infisical "github.com/infisical/go-sdk"
)

// fetchFromInfisical uses the Infisical Go SDK to fetch a secret from a given project/environment.
// This file is only compiled when building with `-tags=infisical`.
func fetchFromInfisical(ctx context.Context, secretKey, projectID, environment, secretPath string) (string, error) {
	// Backward compatibility: map legacy env names to Universal Auth env names
	// expected by the Infisical SDK if the newer vars are not provided.
	if os.Getenv("INFISICAL_UNIVERSAL_AUTH_CLIENT_ID") == "" {
		if legacy := os.Getenv("INFISICAL_CLIENT_ID"); legacy != "" {
			_ = os.Setenv("INFISICAL_UNIVERSAL_AUTH_CLIENT_ID", legacy)
		}
	}
	if os.Getenv("INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET") == "" {
		if legacy := os.Getenv("INFISICAL_CLIENT_SECRET"); legacy != "" {
			_ = os.Setenv("INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET", legacy)
		}
	}

	client := infisical.NewInfisicalClient(ctx, infisical.Config{
		SiteUrl:          os.Getenv("INFISICAL_SITE_URL"),
		AutoTokenRefresh: true,
	})

	// Attempt to authenticate using environment variables (INFISICAL_UNIVERSAL_AUTH_CLIENT_ID/_CLIENT_SECRET)
	if _, err := client.Auth().UniversalAuthLogin("", ""); err != nil {
		return "", fmt.Errorf("infisical: auth failed: %w", err)
	}

	secretRaw, err := client.Secrets().Retrieve(infisical.RetrieveSecretOptions{
		SecretKey:   secretKey,
		ProjectID:   projectID,
		Environment: environment,
		SecretPath:  secretPath,
	})
	if err != nil {
		return "", fmt.Errorf("infisical: failed to retrieve secret: %w", err)
	}

	// Try common shapes for the returned secret using reflection (works for
	// concrete struct types as well as interface{} values).
	rv := reflect.ValueOf(secretRaw)
	if !rv.IsValid() {
		return "", fmt.Errorf("infisical: retrieved secret is invalid")
	}

	// Handle string
	if rv.Kind() == reflect.String {
		return rv.String(), nil
	}

	// Handle []byte
	if rv.Kind() == reflect.Slice && rv.Type().Elem().Kind() == reflect.Uint8 {
		// Convert []byte to string using reflect
		return string(rv.Bytes()), nil
	}

	// If it's a pointer, dereference for struct inspection
	if rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}

	if rv.IsValid() && rv.Kind() == reflect.Struct {
		for _, name := range []string{"SecretValue", "Value", "Secret", "SecretString"} {
			f := rv.FieldByName(name)
			if f.IsValid() && f.Kind() == reflect.String {
				return f.String(), nil
			}
		}
	}

	// Fallback to string representation
	return fmt.Sprintf("%v", secretRaw), nil
}
