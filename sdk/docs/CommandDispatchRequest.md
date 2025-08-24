# CommandDispatchRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**service** | **string** |  | [default to undefined]
**action** | **string** |  | [default to undefined]
**args** | **{ [key: string]: any; }** |  | [optional] [default to undefined]
**require_confirmation** | **boolean** |  | [optional] [default to false]
**channel** | [**Channel**](Channel.md) |  | [optional] [default to undefined]
**routing** | [**Routing**](Routing.md) |  | [optional] [default to undefined]
**audit** | [**CommandDispatchRequestAudit**](CommandDispatchRequestAudit.md) |  | [optional] [default to undefined]

## Example

```typescript
import { CommandDispatchRequest } from '@k2600x/comm-service-sdk';

const instance: CommandDispatchRequest = {
    service,
    action,
    args,
    require_confirmation,
    channel,
    routing,
    audit,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
