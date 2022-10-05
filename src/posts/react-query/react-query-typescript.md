---
title: React Query y TypeScript
date: 2022-10-05
status: draft
original:
  title: React Query and TypeScript
  url: https://tkdodo.eu/blog/react-query-and-type-script
series:
  name: react-query-tkdodo
  index: 6
---

[TypeScript](https://www.typescriptlang.org/) is 🔥 - this seems to be a common understanding now in the frontend community. Many developers expect libraries to either be written in TypeScript, or at least provide good type definitions. For me, if a library is written in TypeScript, the type definitions are the best documentation there is. It's never wrong because it directly reflects the implementation. I frequently look at type definitions before I read API docs.

React Query was initially written in JavaScript (v1), and was then re-written to TypeScript with v2. This means that right now, there is very good support for TypeScript consumers.

There are however a couple of "gotchas" when working with TypeScript due to how dynamic and unopinionated React Query is. Let's go through them one by one to make your experience with it even better.

## Generics

React Query heavily uses [Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html). This is necessary because the library does not actually fetch data for you, and it cannot know what *type* the data will have that your api returns.

The TypeScript section in the [official docs](https://react-query.tanstack.com/typescript) is not very extensive, and it tells us to explicitly specify the Generics that *useQuery* expects when calling it:

```ts:title=explicit-generics
function useGroups() {
  return useQuery<Group[], Error>('groups', fetchGroups)
}
```

Over time, React Query has added more Generics to the *useQuery* hook (there are now four of them), mainly because more functionality was added. The above code works, and it will make sure that the *data* property of our custom hook is correctly typed to `Group[] | undefined` as well as that our *error* will be of type `Error | undefined`. But it will not work like that for more advanced use-cases, especially when the other two Generics are needed.

### The four Generics

This is the current definition of the *useQuery* hook:

```ts:title=useQuery
export function useQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>
```

There's a lot of stuff going on, so let's try to break it down:

- `TQueryFnData`: the type returned from the *queryFn*. In the above example, it's `Group[]`.
- `TError`: the type of Errors to expect from the *queryFn*. `Error` in the example.
- `TData`: the type our *data* property will eventually have. Only relevant if you use the *select* option, because then the *data* property can be different from what the *queryFn* returns. Otherwise, it will default to whatever the *queryFn* returns.
- `TQueryKey`: the type of our *queryKey*, only relevant if you use the *queryKey* that is passed to your *queryFn*.

As you can also see, all those Generics have default values, which means that if you don't provide them, TypeScript will fall back to those types. This works pretty much the same as default parameters in JavaScript:

```js:title=default-parameters
function multiply(a, b = 2) {
  return a * b
}

multiply(10) // ✅ 20
multiply(10, 3) // ✅ 30
```

### Type Inference

TypeScript works best if you let it infer (or figure out) what type something should be on its own. Not only does it make code easier to *write* (because you don't have to type all the types 😅), but it will also make it easier to *read*. In many instances, it can make code look exactly like JavaScript. Some simple examples of type inference would be:

```ts:title=type-inference
const num = Math.random() + 5 // ✅ `number`

// 🚀 both greeting and the result of greet will be string
function greet(greeting = 'ciao') {
  return `${greeting}, ${getName()}`
}
```

When it comes to Generics, they can also generally be inferred from their usage, which is super awesome. You could also provide them manually, but in many cases, you don't need to.

```ts:title=generic-identity
function identity<T>(value: T): T {
  return value
}

// 🚨 no need to provide the generic
let result = identity<number>(23)

// ⚠️ or to annotate the result
let result: number = identity(23)

// 😎 infers correctly to `string`
let result = identity('react-query')
```

### Partial Type Argument Inference

...doesn't exist in TypeScript yet (see this [open issue](https://github.com/microsoft/TypeScript/issues/26242)). This basically means that if you provide *one* Generic, you have to provide *all* of them. But because React Query has default values for Generics, we might not notice right away that they will be taken. The resulting error messages can be quite cryptic. Let's look at an example where this actually backfires:

```ts:title=default-generics
function useGroupCount() {
  return useQuery<Group[], Error>('groups', fetchGroups, {
    select: (groups) => groups.length,
    // 🚨 Type '(groups: Group[]) => number' is not assignable to type '(data: Group[]) => Group[]'.
    // Type 'number' is not assignable to type 'Group[]'.ts(2322)
  })
}
```

Because we haven't provided the 3rd Generic, the default value kicks in, which is also `Group[]`, but we return `number` from our *select* function. One fix is to simply add the 3rd Generic:

```ts:title=third-generic {3}
function useGroupCount() {
  // ✅ fixed it
  return useQuery<Group[], Error, number>('groups', fetchGroups, {
    select: (groups) => groups.length,
  })
}
```

As long as we don't have Partial Type Argument Inference, we have to work with what we got.

So what's the alternative?

### Infer all the things

Let's start by *not* passing in any Generics at all and let TypeScript figure out what to do. For this to work, we need the *queryFn* to have a good return type. Of course, if you inline that function without an explicit return type, you will have *any* - because that's what *axios* or *fetch* give you:

```ts:title=inlined-queryFn
function useGroups() {
  // 🚨 data will be `any` here
  return useQuery('groups', () =>
    axios.get('groups').then((response) => response.data)
  )
}
```

If you (like me) like to keep your api layer separated from your queries, you'll need to add type definitions anyways to avoid *implicit any*, so React Query can infer the rest:

```ts:title=inferred-types
function fetchGroups(): Promise<Group[]> {
  return axios.get('groups').then((response) => response.data)
}

// ✅ data will be `Group[] | undefined` here
function useGroups() {
  return useQuery('groups', fetchGroups)
}

// ✅ data will be `number | undefined` here
function useGroupCount() {
  return useQuery('groups', fetchGroups, {
    select: (groups) => groups.length,
  })
}
```

Advantages of this approach are:

- no more manually specifying Generics
- works for cases where the 3rd (select) and 4th (QueryKey) Generic are needed
- will continue to work if more Generics are added
- code is less confusing / looks more like JavaScript

### What about error?

What about error, you might ask? Per default, without any Generics, error will be inferred to *unknown*. This might sound like a bug, why is it not *Error*? But it is actually on purpose, because in JavaScript, you can throw *anything* - it doesn't have to be of type `Error`:

```js:title=totally-legit-throw-statements
throw 5
throw undefined
throw Symbol('foo')
```

Since React Query is not in charge of the function that returns the Promise, it also can't know what type of errors it might produce. So *unknown* is correct. Once TypeScript allows skipping some generics when calling a function with multiple generics (see [this issue for more information](https://github.com/microsoft/TypeScript/issues/10571)), we could handle this better, but for now, if we need to work with errors and don't want to resort to passing Generics, we can narrow the type with an instanceof check:

```ts:title=narrow-with-instanceof
const groups = useGroups()

if (groups.error) {
  // 🚨 this doesn't work because: Object is of type 'unknown'.ts(2571)
  return <div>An error occurred: {groups.error.message}</div>
}

// ✅ the instanceOf check narrows to type `Error`
if (groups.error instanceof Error) {
  return <div>An error occurred: {groups.error.message}</div>
}
```

Since we need to make some kind of check anyways to see if we have an error, the instanceof check doesn't look like a bad idea at all, and it will also make sure that our error actually has a property message at runtime. This is also in line with what TypeScript has planned for the 4.4 release, where they'll introduce a new compiler flag *useUnknownInCatchVariables*, where catch variables will be *unknown* instead of *any* (see [here](https://github.com/microsoft/TypeScript/issues/41016)).

## Type Narrowing

I rarely use destructuring when working with React Query. First of all, names like *data* and *error* are quite universal (purposefully so), so you'll likely rename them anyway. Keeping the whole object will keep the context of what data it is or where the error is coming from. It will further help TypeScript to narrow types when using the status field or one of the status booleans, which it cannot do if you use destructuring:

```ts:title=type-narrowing
const { data, isSuccess } = useGroups()
if (isSuccess) {
  // 🚨 data will still be `Group[] | undefined` here
}

const groupsQuery = useGroups()
if (groupsQuery.isSuccess) {
  // ✅ groupsQuery.data will now be `Group[]`
}
```

This has nothing to do with React Query, it is just how TypeScript works. [@danvdk](https://twitter.com/danvdk) has a good explanation for this behaviour

<https://twitter.com/danvdk/status/1363614288103964672>

**Update**: TypeScript 4.6 has added [control flow analysis for destructured discriminated unions](https://devblogs.microsoft.com/typescript/announcing-typescript-4-6/#cfa-destructured-discriminated-unions), which makes the above example work. So this is no longer an issue. 🙌

## Type safety with the enabled option

I've expressed my ♥️ for the [enabled option](/react-query/consejos-practicos-react-query/) right from the start, but it can be a bit tricky on type level if you want to use it for [dependent queries](https://react-query.tanstack.com/guides/dependent-queries) and disable your query for as long as some parameters are not yet defined:

```ts:title=the-enabled-option
function fetchGroup(id: number): Promise<Group> {
  return axios.get(`group/${id}`).then((response) => response.data)
}

function useGroup(id: number | undefined) {
  return useQuery(['group', id], () => fetchGroup(id), {
    enabled: Boolean(id),
  })
  // 🚨 Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
  //  Type 'undefined' is not assignable to type 'number'.ts(2345)
}
```

Technically, TypeScript is right, *id* is possibly *undefined*: the *enabled* option does not perform any type narrowing. Also, there are ways to bypass the *enabled* option, for example by calling the *refetch* method returned from *useQuery*. In that case, the *id* might really be *undefined*.

I've found the best way to go here, if you don't like the [non-null assertion operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator), is to accept that *id* can be *undefined* and reject the Promise in the *queryFn*. It's a bit of duplication, but it's also explicit and safe:

```ts:title=explicit-id-check {3-5}
function fetchGroup(id: number | undefined): Promise<Group> {
  // ✅ check id at runtime because it can be `undefined`
  return typeof id === 'undefined'
    ? Promise.reject(new Error('Invalid id'))
    : axios.get(`group/${id}`).then((response) => response.data)
}

function useGroup(id: number | undefined) {
  return useQuery(['group', id], () => fetchGroup(id), {
    enabled: Boolean(id),
  })
}
```

## Optimistic Updates

Getting optimistic updates right in TypeScript is not an easy feat, so we've decided to add it as a comprehensive [example](https://react-query.tanstack.com/examples/optimistic-updates-typescript) to the docs.

The important part is: You have to explicitly type the *variables* argument passed to *onMutate* in order to get the best type inference. I don't fully comprehend why that is, but it again seems to have something to do with inference of Generics. Have a look [at this comment](https://github.com/tannerlinsley/react-query/pull/1366#discussion_r538459890) for more information.

**Update**: TypeScript 4.7 has added [Improved Function Inference in Objects and Methods](https://devblogs.microsoft.com/typescript/announcing-typescript-4-7-beta/#improved-function-inference-in-objects-and-methods), which fixes the issue. Optimistic updates should now infer types for context correctly without extra work. 🥳

## useInfiniteQuery

For the most parts, typing *useInfiniteQuery* is no different from typing *useQuery*. One noticeable gotcha is that the *pageParam* value, which is passed to the *queryFn*, is typed as *any*. Could be improved in the library for sure, but as long as it's *any*, it's probably best to explicitly annotate it:

```ts:title=useInfiniteQuery
type GroupResponse = { next?: number, groups: Group[] }
const queryInfo = useInfiniteQuery(
  'groups',
  // ⚠️ explicitly type pageParam to override `any`
  ({ pageParam = 0 }: { pageParam: GroupResponse['next']) => fetchGroups(groups, pageParam),
  {
    getNextPageParam: (lastGroup) => lastGroup.next,
  }
)
```

If *fetchGroups* returns a *GroupResponse*, *lastGroup* will have its type nicely inferred, and we can use the same type to annotate *pageParam*.

## Typing the default query function

I am personally not using a [defaultQueryFn](https://react-query.tanstack.com/guides/default-query-function), but I know many people are. It's a neat way to leverage the passed *queryKey* to directly build your request url. If you inline the function when creating the *queryClient*, the type of the passed *QueryFunctionContext* will also be inferred for you. TypeScript is just so much better when you inline stuff :)

```ts:title=defaultQueryFn
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey: [url] }) => {
        const { data } = await axios.get(`${baseUrl}/${url}`)
        return data
      },
    },
  },
})
```

This just works, however, *url* is inferred to type *unknown*, because the whole *queryKey* is an *unknown Array*. At the time of the creation of the queryClient, there is absolutely no guarantee how the queryKeys will be constructed when calling *useQuery*, so there is only so much React Query can do. That is just the nature of this highly dynamic feature. It's not a bad thing though because it means you now have to work defensively and narrow the type with runtime checks to work with it, for example:

```ts:title=narrow-with-typeof {6-12}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey: [url] }) => {
        // ✅ narrow the type of url to string so that we can work with it
        if (typeof url === 'string') {
          const { data } = await axios.get(`${baseUrl}/${url.toLowerCase()}`)
          return data
        }
        throw new Error('Invalid QueryKey')
      },
    },
  },
})
```

I think this shows quite well why *unknown* is such a great (and underused) type compared to *any*. It has become my favourite type lately - but that is subject for another blog post. 😊
