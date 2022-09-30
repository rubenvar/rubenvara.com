---
title: Tests en React Query
date: 2022-09-30
status: draft
original:
  title: Testing React Query
  url: https://tkdodo.eu/blog/testing-react-query
series:
  name: react-query-tkdodo
  index: 5
---

Questions around the testing topic come up quite often together with React Query, so I'll try to answer some of them here. I think one reason for that is that testing "smart" components (also called [container components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)) is not the easiest thing to do. With the rise of hooks, this split has been largely deprecated. It is now encouraged to consume hooks directly where you need them rather than doing a mostly arbitrary split and drill props down.

I think this is generally a very good improvement for colocation and code readability, but we now have more components that consume dependencies outside of "just props".

They might *useContext*. They might *useSelector*. Or they might *useQuery*.

Those components are technically no longer pure, because calling them in different environments leads to different results. When testing them, you need to carefully setup those surrounding environments to get things working.

## Mocking network requests

Since React Query is an async server state management library, your components will likely make requests to a backend. When testing, this backend is not available to actually deliver data, and even if, you likely don't want to make your tests dependent on that.

There are tons of articles out there on how to mock data with jest. You can mock your api client if you have one. You can mock fetch or axios directly. I can only second what Kent C. Dodds has written in his article [Stop mocking fetch](https://kentcdodds.com/blog/stop-mocking-fetch):

Use [mock service worker](https://mswjs.io/) by [@ApiMocking](https://twitter.com/ApiMocking)

It can be your single source of truth when it comes to mocking your apis:

- works in node for testing
- supports REST and GraphQL
- has a [storybook addon](https://storybook.js.org/addons/msw-storybook-addon) so you can write stories for your components that *useQuery*
- works in the browser for development purposes, and you'll still see the requests going out in the browser devtools
- works with cypress, similar to fixtures

---

With our network layer being taken care of, we can start talking about React Query specific things to keep an eye on:

## QueryClientProvider

Whenever you use React Query, you need a QueryClientProvider and give it a queryClient - a vessel which holds the *QueryCache*. The cache will in turn hold the data of your queries.

I prefer to give each test its own QueryClientProvider and create a *new QueryClient* for each test. That way, tests are completely isolated from each other. A different approach might be to clear the cache after each test, but I like to keep shared state between tests as minimal as possible. Otherwise, you might get unexpected and flaky results if you run your tests in parallel.

### For custom hooks

If you are testing custom hooks, I'm quite certain you're using [react-hooks-testing-library](https://react-hooks-testing-library.com/). It's the easiest thing there is to test hooks. With that library, we can wrap our hook in a [wrapper](https://react-hooks-testing-library.com/reference/api#wrapper), which is a React component to wrap the test component in when rendering. I think this is the perfect place to create the QueryClient, because it will be executed once per test:

```tsx:title=wrapper
const createWrapper = () => {
  // ✅ creates a new QueryClient for each test
  const queryClient = new QueryClient()
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test("my first test", async () => {
  const { result } = renderHook(() => useCustomHook(), {
    wrapper: createWrapper()
  })
})
```

### For components

If you want to test a Component that uses a *useQuery* hook, you also need to wrap that Component in QueryClientProvider. A small wrapper around *render* from [react-testing-library](https://testing-library.com/docs/react-testing-library/intro/) seems like a good choice. Have a look at how React Query does it [internally for their tests](https://github.com/tannerlinsley/react-query/blob/ead2e5dd5237f3d004b66316b5f36af718286d2d/src/react/tests/utils.tsx#L6-L17).

## Turn off retries

It's one of the most common "gotchas" with React Query and testing: The library defaults to three retries with exponential backoff, which means that your tests are likely to timeout if you want to test an erroneous query. The easiest way to turn retries off is, again, via the *QueryClientProvider*. Let's extend the above example:

```tsx:title=no-retries {2-9}
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // ✅ turns retries off
        retry: false,
      },
    },
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test("my first test", async () => {
  const { result } = renderHook(() => useCustomHook(), {
    wrapper: createWrapper()
  })
}
```

This will set the defaults for all queries in the component tree to "no retries". It is important to know that this will only work if your actual *useQuery* has no explicit retries set. If you have a query that wants 5 retries, this will still take precedence, because defaults are only taken as a fallback.

### setQueryDefaults

The best advice I can give you for this problem is: Don't set these options on *useQuery* directly. Try to use and override the defaults as much as possible, and if you really need to change something for specific queries, use [queryClient.setQueryDefaults](https://react-query.tanstack.com/reference/QueryClient#queryclientsetquerydefaults).

So for example, instead of setting retry on *useQuery*:

```tsx:title=not-on-useQuery
const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Example />
    </QueryClientProvider>
  )
}

function Example() {
  // 🚨 you cannot override this setting for tests!
  const queryInfo = useQuery('todos', fetchTodos, { retry: 5 })
}
```

Set it like this:

```tsx:title=setQueryDefaults {9-10}
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
    },
  },
})

// ✅ only todos will retry 5 times
queryClient.setQueryDefaults('todos', { retry: 5 })

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Example />
    </QueryClientProvider>
  )
}
```

Here, all queries will retry two times, only *todos* will retry five times, and I still have the option to turn it off for all queries in my tests 🙌.

### ReactQueryConfigProvider

Of course, this only works for known query keys. Sometimes, you really want to set some configs on a subset of your component tree. In v2, React Query had a [ReactQueryConfigProvider](https://react-query-v2.tanstack.com/docs/api#reactqueryconfigprovider) for that exact use-case. You can achieve the same thing in v3 with a couple of lines of codes:

```jsx:title=ReactQueryConfigProvider
const ReactQueryConfigProvider = ({ children, defaultOptions }) => {
  const client = useQueryClient()
  const [newClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: client.getQueryCache(),
        muationCache: client.getMutationCache(),
        defaultOptions,
      })
  )

  return (
    <QueryClientProvider client={newClient}>{children}</QueryClientProvider>
  )
}
```

You can see this in action in this [codesandbox example](https://codesandbox.io/s/react-query-config-provider-v3-lt00f).

## Always await the query

Since React Query is async by nature, when running the hook, you won't immediately get a result. It usually will be in loading state and without data to check. The [async utilities](https://react-hooks-testing-library.com/reference/api#async-utilities) from react-hooks-testing-library offer a lot of ways to solve this problem. For the simplest case, we can just wait until the query has transitioned to success state:

```tsx:title=waitFor {19-22}
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

test("my first test", async () => {
  const { result, waitFor } = renderHook(() => useCustomHook(), {
    wrapper: createWrapper()
  })

  // ✅ wait until the query has transitioned to success state
  await waitFor(() => result.current.isSuccess)

  expect(result.current.data).toBeDefined()
}
```

**Update**:

[@testing-library/react v13.1.0](https://github.com/testing-library/react-testing-library/releases/tag/v13.1.0) also has a new [renderHook](https://testing-library.com/docs/react-testing-library/api/#renderhook) that you can use. However, it doesn't return its own *waitFor* util, so you'll have to use the one you can [import from @testing-library/react](https://testing-library.com/docs/dom-testing-library/api-async/#waitfor) instead. The API is a bit different, as it doesn't allow to return a *boolean*, but expects a *Promise* instead. That means we must adapt our code slightly:

```tsx:title=new-render-hook
import { waitFor, renderHook } from '@testing-library/react'

test("my first test", async () => {
  const { result } = renderHook(() => useCustomHook(), {
    wrapper: createWrapper()
  })

  // ✅ return a Promise via expect to waitFor
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  expect(result.current.data).toBeDefined()
}
```

## Silence the error console

Per default, React Query prints errors to the console. I think this is quite disturbing during testing, because you'll see 🔴 in the console even though all tests are 🟢. React Query allows overwriting that default behaviour by [setting a logger](https://react-query.tanstack.com/reference/setLogger), so that's what I'm usually doing:

```ts:title=silence-errors
import { setLogger } from 'react-query'

setLogger({
  log: console.log,
  warn: console.warn,
  // ✅ no more errors on the console
  error: () => {},
})
```

**Update**

*setLogger* was removed in v4. Instead, you can pass your custom logger as prop to the *QueryClient* you create:

```js:title=logger-prop
const queryClient = new QueryClient({
  logger: {
    log: console.log,
    warn: console.warn,
    // ✅ no more errors on the console
    error: () => {},
  }
})
```

Also, errors are not logged in production mode anymore to avoid confusion.

## Putting it all together

I've set up a quick repository where all of this comes nicely together: mock-service-worker, react-testing-library and the mentioned wrapper. It contains four tests - basic failure and success tests for custom hooks and components. Have a look here: <https://github.com/TkDodo/testing-react-query>

---

That's it for today. Feel free to reach out to me on [twitter](https://twitter.com/tkdodo)
if you have any questions, or just leave a comment below. ⬇️
