# MessageSendRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**channel** | [**Channel**](Channel.md) |  | [default to undefined]
**template_key** | **string** |  | [default to undefined]
**locale** | **string** |  | [optional] [default to undefined]
**data** | **{ [key: string]: any; }** | Variables de la plantilla (clave/valor) | [default to undefined]
**to** | [**To**](To.md) |  | [default to undefined]
**require_confirmation** | **boolean** |  | [optional] [default to false]
**routing** | [**Routing**](Routing.md) |  | [optional] [default to undefined]
**metadata** | **{ [key: string]: any; }** |  | [optional] [default to undefined]

## Example

```typescript
import { MessageSendRequest } from '@k2600x/comm-service-sdk';

const instance: MessageSendRequest = {
    channel,
    template_key,
    locale,
    data,
    to,
    require_confirmation,
    routing,
    metadata,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
