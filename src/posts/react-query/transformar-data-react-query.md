---
title: Transformaciones de data con React Query
date: 2022-09-28
status: draft
original:
  title: React Query Data Transformations
  url: https://tkdodo.eu/blog/react-query-data-transformations
series:
  name: react-query-tkdodo
  index: 2
---

Welcome to Part 2 of "Things I have to say about react-query". As I've become more and more involved with the library and the community around it, I've observed some more patterns people frequently ask about. Initially, I wanted to write them all down in one big article, but then decided to break them down into more manageable pieces. The first one is about a quite common and important task: Data Transformation.

## Data Transformation

Let's face it - most of us are *not* using GraphQL. If you do, then you can be very happy because you have the luxury of requesting your data in the format that you desire.

If you are working with REST though, you are constrained by what the backend returns. So how and where do you best transform data when working with react-query? The only answer worth a damn in software development applies here as well:

> It depends.

<p style="padding-left: 3rem; margin-top: -1rem">
  — Every developer, always
</p>

Here are 3+1 approaches on where you *can* transform data with their respective pros and cons:

### 0. On the backend

This is my favourite approach, if you can afford it. If the backend returns data in exactly the structure we want, there is nothing we need to do. While this might sound unrealistic in many cases, e.g. when working with public REST APIs, it is also quite possible to achieve in enterprise applications. If you are in control of the backend and have an endpoint that returns data for your exact use-case, prefer to deliver the data the way you expect it.

🟢 &nbsp; no work on the frontend<br/>
🔴 &nbsp; not always possible

### 1. In the queryFn

The *queryFn* is the function that you pass to *useQuery*. It expects you to return a Promise, and the resulting data winds up in the query cache. But it doesn't mean that you have to absolutely return data in the structure that the backend delivers here. You can transform it before doing so:

```ts:title=queryFn-transformation
const fetchTodos = async (): Promise<Todos> => {
  const response = await axios.get('todos')
  const data: Todos = response.data

  return data.map((todo) => todo.name.toUpperCase())
}

export const useTodosQuery = () => useQuery(['todos'], fetchTodos)
```

On the frontend, you can then work with this data "as if it came like this from the backend". No where in your code will you actually work with todo names that are *not* upper-cased. You will also *not* have access to the original structure. If you look at the react-query-devtools, you will see the transformed structure. If you look at the network trace, you'll see the original structure. This might be confusing, so keep that in mind.

Also, there is no optimization that react-query can do for you here. Every time a fetch is executed, your transformation will run. If it's expensive, consider one of the other alternatives. Some companies also have a shared api layer that abstracts data fetching, so you might not have access to this layer to do your transformations.

🟢 &nbsp; very "close to the backend" in terms of co-location<br/>
🟡 &nbsp; the transformed structure winds up in the cache, so you don't have access to the original structure<br/>
🔴 &nbsp; runs on every fetch<br/>
🔴 &nbsp; not feasible if you have a shared api layer that you cannot freely modify

### 2. In the render function

As advised in [Part 1](practical-react-query), if you create custom hooks, you can easily do transformations there:

```ts:title=render-transformation
const fetchTodos = async (): Promise<Todos> => {
  const response = await axios.get('todos')
  return response.data
}

export const useTodosQuery = () => {
  const queryInfo = useQuery(['todos'], fetchTodos)

  return {
    ...queryInfo,
    data: queryInfo.data?.map((todo) => todo.name.toUpperCase()),
  }
}
```

As it stands, this will not only run every time your fetch function runs, but actually on every render (even those that do not involve data fetching). This is likely not a problem at all, but if it is, you can optimize with *useMemo*. Be careful to define your dependencies *as narrow as possible*. `data` inside the queryInfo will be referentially stable unless something really changed (in which case you want to recompute your transformation), but the `queryInfo` itself will *not*. If you add *queryInfo* as your dependency, the transformation will again run on every render:

```ts:title=useMemo-dependencies
export const useTodosQuery = () => {
  const queryInfo = useQuery(['todos'], fetchTodos)

  return {
    ...queryInfo,
    // 🚨 don't do this - the useMemo does nothing at all here!
    data: React.useMemo(
      () => queryInfo.data?.map((todo) => todo.name.toUpperCase()),
      [queryInfo]
    ),

    // ✅ correctly memoizes by queryInfo.data
    data: React.useMemo(
      () => queryInfo.data?.map((todo) => todo.name.toUpperCase()),
      [queryInfo.data]
    ),
  }
}
```

Especially if you have additional logic in your custom hook to combine with your data transformation, this is a good option. Be aware that data can be potentially undefined, so use optional chaining when working with it.

🟢 &nbsp; optimizable via useMemo<br/>
🟡 &nbsp; exact structure cannot be inspected in the devtools<br/>
🔴 &nbsp; a bit more convoluted syntax<br/>
🔴 &nbsp; data can be potentially undefined<br/>

### 3. using the select option

v3 introduced built-in selectors, which can also be used to transform data:

```ts:title=select-transformation
export const useTodosQuery = () =>
  useQuery(['todos'], fetchTodos, {
    select: (data) => data.map((todo) => todo.name.toUpperCase()),
  })
```

selectors will only be called if *data* exists, so you don't have to care about *undefined* here. Selectors like the one above will also run on every render, because the functional identity changes (it's an inline function). If your transformation is expensive, you can memoize it either with useCallback, or by extracting it to a stable function reference:

```ts:title=select-memoizations
const transformTodoNames = (data: Todos) =>
  data.map((todo) => todo.name.toUpperCase())

export const useTodosQuery = () =>
  useQuery(['todos'], fetchTodos, {
    // ✅ uses a stable function reference
    select: transformTodoNames,
  })

export const useTodosQuery = () =>
  useQuery(['todos'], fetchTodos, {
    // ✅ memoizes with useCallback
    select: React.useCallback(
      (data: Todos) => data.map((todo) => todo.name.toUpperCase()),
      []
    ),
  })
```

Further, the select option can also be used to subscribe to only parts of the data. This is what makes this approach truly unique. Consider the following example:

```js:title=select-partial-subscriptions
export const useTodosQuery = (select) =>
  useQuery(['todos'], fetchTodos, { select })

export const useTodosCount = () => useTodosQuery((data) => data.length)
export const useTodo = (id) =>
  useTodosQuery((data) => data.find((todo) => todo.id === id))
```

Here, we've created a [useSelector](https://react-redux.js.org/api/hooks#useselector) like API by passing a custom selector to our *useTodosQuery*. The custom hooks still works like before, as *select* will be *undefined* if you don't pass it, so the whole state will be returned.

But if you pass a selector, you are now only subscribed to the result of the selector function. This is quite powerful, because it means that even if we update the name of a todo, our component that only subscribes to the count via *useTodosCount* will *not* rerender. The count hasn't changed, so react-query can choose to *not* inform this observer about the update 🥳 (Please note that this is a bit simplified here and technically not entirely true - I will talk in more detail about render optimizations in Part 3).

🟢 &nbsp; best optimizations<br/>
🟢 &nbsp; allows for partial subscriptions<br/>
🟡 &nbsp; structure can be different for every observer<br/>
🟡 &nbsp; structural sharing is performed twice (I will also talk about this in more detail in Part 3)
