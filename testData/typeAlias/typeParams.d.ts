type Values<V> = List<V>;
type MultiMap<K,V> = Map<K,Values<V>>;
type Headers = MultiMap<String,String>
type Ref<T> = string | ((instance: T) => any);

declare var fooMap: MultiMap<string,number>;

declare function mapKey(a: MultiMap<number,String>);

declare var fooStringOrMap: string | MultiMap<string,number>;

declare function stringOrMapKey(a: string | MultiMap<number,String>);

declare var listOfStringOrNumber: string | List<string | number>;

declare function listOfNumberOrString(a: List<number | String>);

declare var headers: Headers;

declare function getHeaders(): Headers;

declare function addHeaders(headers: Headers);

declare var someRef: Ref<number>;

declare function addRef(ref: Ref<number>);
