<template>
  <nav class="main-nav">
    <router-link to="/editor">Editor</router-link>
    |
    <router-link to="/patients">Patient List</router-link>
  </nav>
  <router-view/>
</template>

<style>
.main-nav {
  padding: 1rem;
  background: #f5f5f5;
}
.main-nav a {
  margin: 0 0.5rem;
  text-decoration: none;
  color: #333;
}
.main-nav a.router-link-active {
  font-weight: bold;
}
</style>
