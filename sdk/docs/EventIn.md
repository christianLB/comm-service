# EventIn


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**command_id** | **string** |  | [default to undefined]
**service** | **string** |  | [default to undefined]
**status** | **string** |  | [default to undefined]
**output** | **{ [key: string]: any; }** |  | [optional] [default to undefined]
**error** | **string** |  | [optional] [default to undefined]
**metrics** | [**EventInMetrics**](EventInMetrics.md) |  | [optional] [default to undefined]

## Example

```typescript
import { EventIn } from '@k2600x/comm-service-sdk';

const instance: EventIn = {
    command_id,
    service,
    status,
    output,
    error,
    metrics,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
