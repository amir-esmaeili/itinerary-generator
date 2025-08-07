<script>
  import "./styles.css";
</script>

<main>
  <slot />
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    font-family: sans-serif;
    max-width: 800px;
    margin: 0 auto;
  }
</style>
