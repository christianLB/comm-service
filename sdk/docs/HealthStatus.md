# HealthStatus


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**status** | **string** |  | [optional] [default to undefined]
**timestamp** | **string** |  | [optional] [default to undefined]
**service** | **string** |  | [optional] [default to undefined]
**version** | **string** |  | [optional] [default to undefined]
**dependencies** | [**HealthStatusDependencies**](HealthStatusDependencies.md) |  | [optional] [default to undefined]

## Example

```typescript
import { HealthStatus } from '@k2600x/comm-service-sdk';

const instance: HealthStatus = {
    status,
    timestamp,
    service,
    version,
    dependencies,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
