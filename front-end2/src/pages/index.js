import React, { useState } from "react"
import { useQuery, gql, useMutation } from "@apollo/client"
import shortid from "shortid"



const GET_NOTES = gql`
  query {
    listNotes {
    completed
    id
    name
  }
  }
`

const CREATE_NOTES = gql`
  mutation createNote( $note: NoteInput!) {
    createNote(note:$note) {
      id
      name
      completed
    }
  }
`

const CREATE_EVENT = gql`
  mutation createEvent( $id: String!, $name: String!, $completed: String!) {
    createEvent(id:$id, name:$name, completed:$completed) {
      result
    }
  }
`




export default function Home() {
  const [name,setName] = useState("")
  const { data, loading } = useQuery(GET_NOTES)
  const [createNote] = useMutation(CREATE_NOTES)
  const [createEvent] = useMutation(CREATE_EVENT)
  
  
  const handleSubmit = async () => {
    const note = {
      id: shortid.generate(),
      name,
      completed: 'false',
    }
    console.log("Creating Todo:", note)
    setName("")
    // await createNote({
    //   variables: {
    //     note,
    //   },
    //   refetchQueries:[{query:GET_NOTES}]
    // }
    
    // )

    await createEvent({
      variables: {
        id:note.id,
        name:note.name,
        completed:note.completed,
      }
    })
  }

  return (<div><div>
    {loading && <h1>Loading ...</h1>}
      <label> To Dos
      <input
      value={name}
      type="text"
      placeholder="Thing to do "
      onChange={({ target }) => setName(target.value)}
      />
      </label>
      <button
      onClick={() => handleSubmit()}
      >Add Todo</button>
    </div>


    {!loading &&
      data &&
      data.listNotes.map(item => (
        <div style={{ marginLeft: "1rem", marginTop: "2rem" }} key={item.id}>
          {item.name} {item.completed ? "DONE" : "NOT COMPLETED"}
        </div>
      ))}</div>)
}
